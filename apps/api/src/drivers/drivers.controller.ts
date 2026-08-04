import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  deliverSchema,
  driverLocationSchema,
  driverStatusSchema,
  pickupSchema,
  type DeliverInput,
  type DriverStatusInput,
  type PickupInput,
} from '@hillexpress/shared';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { Audiences, CurrentUser, JwtGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/auth.types';
import { DriversService } from './drivers.service';
import { OrdersService } from '../orders/orders.service';

type LocationInput = z.infer<typeof driverLocationSchema>;

@ApiTags('driver')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Audiences('DRIVER')
@Controller('driver')
export class DriversController {
  constructor(
    private readonly drivers: DriversService,
    private readonly orders: OrdersService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Duty status, COD outstanding, today count' })
  summary(@CurrentUser() user: JwtPayload) {
    return this.drivers.summary(user.driverId!);
  }

  @Patch('status')
  @ApiOperation({ summary: 'Go on/off duty' })
  setStatus(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(driverStatusSchema)) dto: DriverStatusInput,
  ) {
    return this.drivers.setStatus(user.driverId!, dto.status);
  }

  @Post('location')
  @ApiOperation({ summary: 'Ping last-known position (no history stored in v1)' })
  location(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(driverLocationSchema)) dto: LocationInput,
  ) {
    return this.drivers.updateLocation(user.driverId!, dto.lat, dto.lng);
  }

  @Get('orders')
  @ApiOperation({ summary: 'My assigned deliveries, oldest first' })
  queue(@CurrentUser() user: JwtPayload) {
    return this.orders.driverQueue(user.driverId!);
  }

  @Post('orders/:id/accept')
  @ApiOperation({ summary: 'Accept the assignment' })
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orders.driverAcceptAssignment(user.driverId!, id);
  }

  @Post('orders/:id/pickup')
  @ApiOperation({ summary: 'Pickup — store reads the 4-digit code; commits the stock sale' })
  pickup(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodPipe(pickupSchema)) dto: PickupInput,
  ) {
    return this.orders.driverPickup(user.driverId!, id, dto.otp);
  }

  @Post('orders/:id/deliver')
  @ApiOperation({ summary: 'Deliver — customer code + cash actually collected' })
  deliver(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodPipe(deliverSchema)) dto: DeliverInput,
  ) {
    return this.orders.driverDeliver(user.driverId!, id, dto.otp, dto.collectedPaise);
  }
}
