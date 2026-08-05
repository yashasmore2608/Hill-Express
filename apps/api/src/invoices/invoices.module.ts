import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminInvoicesController, InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [InvoicesController, AdminInvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService], // orders issue the invoice on delivery
})
export class InvoicesModule {}
