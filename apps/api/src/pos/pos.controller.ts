import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createProductSchema,
  importRequestSchema,
  patchProductSchema,
  patchStoreSchema,
  productsQuerySchema,
  stockAdjustSchema,
  type CreateProductInput,
  type ImportRequestInput,
  type PatchProductInput,
  type PatchStoreInput,
  type ProductsQueryInput,
  type StockAdjustInput,
} from '@hillexpress/shared';
import { ZodPipe } from '../common/zod.pipe';
import { Audiences, CurrentUser, JwtGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/auth.types';
import { PosService } from './pos.service';
import { ImportService } from './import.service';

/** Everything here is scoped to the operator's OWN store via the JWT —
 *  a storeId never travels in the URL, so it can never be someone else's. */
@ApiTags('pos')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Audiences('POS')
@Controller('pos')
export class PosController {
  constructor(
    private readonly pos: PosService,
    private readonly importer: ImportService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Store status + product/low-stock/out-of-stock counts' })
  summary(@CurrentUser() user: JwtPayload) {
    return this.pos.summary(user.storeId!);
  }

  @Patch('store')
  @ApiOperation({ summary: 'Toggle open/closed, set default packing time' })
  patchStore(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(patchStoreSchema)) dto: PatchStoreInput,
  ) {
    return this.pos.patchStore(user.storeId!, dto, user.sub);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create one product — same shape as a CSV import row' })
  createProduct(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(createProductSchema)) dto: CreateProductInput,
  ) {
    return this.pos.createProduct(user.storeId!, dto, user.sub);
  }

  @Get('products')
  @ApiOperation({ summary: "Operator's product list — includes hidden and out-of-stock" })
  products(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodPipe(productsQuerySchema)) q: ProductsQueryInput,
    @Query('filter') filter?: 'low' | 'out',
  ) {
    return this.pos.products(user.storeId!, {
      cursor: q.cursor,
      limit: q.limit,
      search: q.search,
      filter: filter === 'low' || filter === 'out' ? filter : undefined,
    });
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Edit price / MRP / availability / low-stock threshold' })
  patchProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodPipe(patchProductSchema)) dto: PatchProductInput,
  ) {
    return this.pos.patchProduct(user.storeId!, id, dto, user.sub);
  }

  @Post('products/:id/stock')
  @ApiOperation({ summary: 'Adjust stock — writes product + ledger in one transaction' })
  adjustStock(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodPipe(stockAdjustSchema)) dto: StockAdjustInput,
  ) {
    return this.pos.adjustStock(user.storeId!, id, dto, user.sub);
  }

  @Post('import')
  @ApiOperation({ summary: 'Bulk CSV import — upsert by SKU, per-row error report' })
  import(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(importRequestSchema)) dto: ImportRequestInput,
  ) {
    return this.importer.run(user.storeId!, user.sub, dto);
  }
}
