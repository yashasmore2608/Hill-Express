import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { ImportService } from './import.service';

@Module({
  imports: [AuthModule],
  controllers: [PosController],
  providers: [PosService, ImportService],
})
export class PosModule {}
