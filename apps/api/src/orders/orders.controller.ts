import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cancelOrderSchema,
  placeOrderSchema,
  type PlaceOrderInput,
} from '@hillexpress/shared';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { Audiences, CurrentUser, JwtGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/auth.types';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Audiences('CUSTOMER')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Place a COD order — idempotent by client key' })
  place(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(placeOrderSchema)) dto: PlaceOrderInput,
  ) {
    return this.orders.place(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'My orders, newest first (keyset-paginated)' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit', new ZodPipe(z.coerce.number().int().min(1).max(50).default(20)))
    limit?: number,
  ) {
    return this.orders.listForCustomer(user.sub, cursor, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Order detail with items, bill, and timeline' })
  detail(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orders.detailForCustomer(user.sub, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel — only while PLACED; releases reserved stock' })
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodPipe(cancelOrderSchema)) dto: { reason: string },
  ) {
    return this.orders.cancelByCustomer(user.sub, id, dto.reason);
  }
}
