import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { ConsoleSmsProvider, SmsProvider } from './sms.provider';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtGuard,
    // Launch swap: { provide: SmsProvider, useClass: Msg91SmsProvider }
    { provide: SmsProvider, useClass: ConsoleSmsProvider },
  ],
  exports: [AuthService, JwtGuard],
})
export class AuthModule {}
