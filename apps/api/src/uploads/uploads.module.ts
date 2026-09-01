import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminUploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthModule], // the upload route is admin-only, so it needs JwtGuard
  controllers: [AdminUploadsController],
  providers: [UploadsService],
  exports: [UploadsService], // banners bin artwork, invoices store PDFs
})
export class UploadsModule {}
