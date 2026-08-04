import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  acceptOrderSchema,
  rejectOrderSchema,
  type AcceptOrderInput,
  type RejectOrderInput,
} from '@hillexpress/shared';
import { ZodPipe } from '../common/zod.pipe';
import { Audiences, CurrentUser, JwtGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/auth.types';
import { OrdersService } from './orders.service';

/** The store operator's queue. Store scope comes from the JWT, never the URL. */
@ApiTags('pos')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Audiences('POS')
@Controller('pos/orders')
export class PosOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Order queue — active (FIFO) or history' })
  queue(@CurrentUser() user: JwtPayload, @Query('scope') scope?: string) {
    return this.orders.posQueue(user.storeId!, scope === 'history' ? 'history' : 'active');
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept — optional packing-time override (FR-P-003)' })
  accept(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodPipe(acceptOrderSchema)) dto: AcceptOrderInput,
  ) {
    return this.orders.accept(user.storeId!, user.sub, id, dto.prepMinutes);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject with a reason — releases reserved stock' })
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodPipe(rejectOrderSchema)) dto: RejectOrderInput,
  ) {
    return this.orders.reject(user.storeId!, user.sub, id, dto.reason);
  }

  @Post(':id/packing')
  @ApiOperation({ summary: 'Start packing' })
  packing(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orders.startPacking(user.storeId!, user.sub, id);
  }

  @Post(':id/ready')
  @ApiOperation({ summary: 'Ready for pickup — driver assignment is Admin-only (§1.3)' })
  ready(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orders.markReady(user.storeId!, user.sub, id);
  }
}
