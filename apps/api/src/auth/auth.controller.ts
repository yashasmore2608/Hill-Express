import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminLoginSchema,
  refreshTokenSchema,
  requestOtpSchema,
  verifyOtpSchema,
  type AdminLoginInput,
  type RefreshTokenInput,
  type RequestOtpInput,
  type VerifyOtpInput,
} from '@hillexpress/shared';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';
import { CurrentUser, JwtGuard } from './jwt.guard';
import type { JwtPayload } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @ApiOperation({ summary: 'Send a login OTP (dev: OTP is returned + logged to console)' })
  requestOtp(@Body(new ZodPipe(requestOtpSchema)) dto: RequestOtpInput) {
    return this.auth.requestOtp(dto.phone, dto.audience);
  }

  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP → access + refresh tokens (customer auto-created)' })
  verifyOtp(@Body(new ZodPipe(verifyOtpSchema)) dto: VerifyOtpInput) {
    return this.auth.verifyOtp(dto.phone, dto.otp, dto.audience);
  }

  @Post('admin/login')
  @ApiOperation({ summary: 'Admin sign-in — email + password' })
  adminLogin(@Body(new ZodPipe(adminLoginSchema)) dto: AdminLoginInput) {
    return this.auth.adminLogin(dto.email, dto.password);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate tokens using a refresh token' })
  refresh(@Body(new ZodPipe(refreshTokenSchema)) dto: RefreshTokenInput) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current session payload' })
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
