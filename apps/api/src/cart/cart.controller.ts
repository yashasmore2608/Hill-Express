import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { setCartItemSchema, type SetCartItemInput } from '@hillexpress/shared';
import { ZodPipe } from '../common/zod.pipe';
import { Audiences, CurrentUser, JwtGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/auth.types';
import { CartService } from './cart.service';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Audiences('CUSTOMER')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Current cart for a store, with authoritative bill' })
  get(@CurrentUser() user: JwtPayload, @Query('storeId') storeId: string) {
    return this.cart.get(user.sub, storeId);
  }

  @Put('items')
  @ApiOperation({ summary: 'Set line quantity (0 removes) — idempotent, server-clamped' })
  setItem(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(setCartItemSchema)) dto: SetCartItemInput,
  ) {
    return this.cart.setItem(user.sub, dto);
  }
}
