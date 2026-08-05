import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { Audiences, CurrentUser, JwtGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/auth.types';
import { INVOICE_LINK_TTL_MS, signInvoiceLink, verifyInvoiceLink } from '../config/secrets';
import { UploadsService } from '../uploads/uploads.service';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly uploads: UploadsService,
  ) {}

  @Get('order/:orderId')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Audiences('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'The invoice for one order' })
  forOrder(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    // Customers are scoped to their own orders; an admin sees any.
    return this.invoices.forOrder(orderId, user.aud === 'CUSTOMER' ? user.sub : undefined);
  }

  /**
   * A 15-minute signed URL for the PDF.
   *
   * The phone hands this straight to the OS browser or a share sheet, neither
   * of which can carry an Authorization header.
   */
  @Get(':id/link')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Audiences('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'Short-lived signed download link for the invoice PDF' })
  async link(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const invoice = await this.invoices.byId(id, user.aud === 'CUSTOMER' ? user.sub : undefined);
    const exp = Date.now() + INVOICE_LINK_TTL_MS;
    return {
      url: `/v1/invoices/${invoice.id}/document?exp=${exp}&sig=${signInvoiceLink(invoice.id, exp)}`,
      expiresAt: new Date(exp).toISOString(),
      invoiceNo: invoice.invoiceNo,
    };
  }

  /**
   * Stream the PDF.
   *
   * Deliberately NOT a static file: the document carries the customer's name,
   * phone and delivery address. Access is either a bearer token (admin panel)
   * or a signed link this API minted (mobile). An unguessable filename is
   * defence in depth, never the lock.
   */
  @Get(':id/document')
  @ApiOperation({ summary: 'Download the invoice PDF (bearer token or signed link)' })
  async document(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('exp') exp?: string,
    @Query('sig') sig?: string,
  ): Promise<void> {
    // Signed links are self-authorising: the signature was issued to someone
    // who had already passed the ownership check in `link()` above.
    if (!(sig && exp && verifyInvoiceLink(id, Number(exp), sig))) {
      throw new UnauthorizedException('This invoice link has expired — open it from the app again');
    }

    const invoice = await this.invoices.byId(id);
    const url = invoice.documentUrl ?? (await this.invoices.renderAndAttach(invoice.id));
    const abs = resolve(this.uploads.root, url.replace(/^\/uploads\//, ''));
    // Containment check — the path came from our own row, but a corrupted
    // value must not be able to read outside the upload root.
    if (!abs.startsWith(this.uploads.root + sep)) throw new NotFoundException('Invoice file missing');
    try {
      await stat(abs);
    } catch {
      throw new NotFoundException('Invoice file missing');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${invoice.invoiceNo.replace(/\//g, '-')}.pdf"`,
    );
    // Never cached by a shared proxy — this is per-customer content.
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    createReadStream(abs).pipe(res);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Audiences('ADMIN')
@Controller('admin/invoices')
export class AdminInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'All invoices, keyset-paginated' })
  list(@Query('cursor') cursor?: string, @Query('paymentStatus') paymentStatus?: string) {
    return this.invoices.list({ cursor, paymentStatus });
  }

  @Post('backfill')
  @ApiOperation({ summary: 'Issue invoices for delivered orders that have none' })
  backfill() {
    return this.invoices.backfill();
  }
}
