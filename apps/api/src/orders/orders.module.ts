import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AddressesModule } from '../addresses/addresses.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { OrdersController } from './orders.controller';
import { PosOrdersController } from './pos-orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, AddressesModule, InvoicesModule],
  controllers: [OrdersController, PosOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
