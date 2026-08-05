import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminBannersController, BannersController } from './banners.controller';
import { BannersService } from './banners.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [BannersController, AdminBannersController],
  providers: [BannersService],
})
export class BannersModule {}
