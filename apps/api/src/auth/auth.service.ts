import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { LIMITS } from '@hillexpress/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SmsProvider } from './sms.provider';
import { env } from '../config/env';
import { accessSecret, refreshSecret, verifyPassword } from '../config/secrets';
import type { AuthAudience, AuthTokens, JwtPayload } from './auth.types';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sms: SmsProvider,
  ) {
    if (!env.JWT_ACCESS_SECRET) {
      this.logger.warn(
        'JWT secrets not set — using random per-boot secrets (dev only; all tokens die on restart)',
      );
    }
  }

  private hashOtp(phone: string, otp: string): string {
    return createHash('sha256').update(`${phone}:${otp}:${accessSecret}`).digest('hex');
  }

  // ── request OTP ──────────────────────────────────────────────────────
  async requestOtp(phone: string, audience: AuthAudience) {
    const db = this.prisma.db;

    // The phone must belong to someone for DRIVER/POS — those accounts are
    // created by Admin, never self-registered.
    if (audience === 'DRIVER') {
      const driver = await db.driver.findUnique({ where: { phone } });
      if (!driver) throw new ForbiddenException('No driver account for this number — ask Admin');
    } else if (audience === 'POS') {
      const store = await db.store.findFirst({ where: { phone } });
      if (!store) throw new ForbiddenException('No store account for this number — ask Admin');
    }

    // Rate limit: max 3 OTPs per phone per expiry window.
    const windowStart = new Date(Date.now() - LIMITS.otpExpiryMinutes * 60_000);
    const recent = await db.otpToken.count({
      where: { phone, purpose: 'LOGIN', createdAt: { gte: windowStart } },
    });
    if (recent >= 3) {
      throw new HttpException(
        'Too many codes requested — wait a few minutes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = String(randomInt(1000, 10_000)); // 4 digits, crypto-random
    await db.otpToken.create({
      data: {
        phone,
        otpHash: this.hashOtp(phone, otp),
        purpose: 'LOGIN',
        expiresAt: new Date(Date.now() + LIMITS.otpExpiryMinutes * 60_000),
      },
    });

    await this.sms.sendOtp(phone, otp);

    return {
      ok: true as const,
      expiresInSec: LIMITS.otpExpiryMinutes * 60,
      // Surfaced ONLY in development so the flow is testable before an SMS
      // provider exists. Never present in production responses.
      ...(env.NODE_ENV === 'development' ? { devOtp: otp } : {}),
    };
  }

  // ── verify OTP → tokens ──────────────────────────────────────────────
  async verifyOtp(phone: string, otp: string, audience: AuthAudience) {
    const db = this.prisma.db;

    const token = await db.otpToken.findFirst({
      where: { phone, purpose: 'LOGIN', consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) throw new UnauthorizedException('Code expired — request a new one');

    if (token.attempts >= LIMITS.otpMaxAttempts) {
      throw new UnauthorizedException('Too many wrong attempts — request a new code');
    }

    const expected = Buffer.from(token.otpHash);
    const actual = Buffer.from(this.hashOtp(phone, otp));
    const valid = expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!valid) {
      await db.otpToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      const left = LIMITS.otpMaxAttempts - token.attempts - 1;
      throw new UnauthorizedException(
        left > 0 ? `Wrong code — ${left} ${left === 1 ? 'try' : 'tries'} left` : 'Too many wrong attempts — request a new code',
      );
    }

    await db.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });

    const payload = await this.buildPayload(phone, audience);
    return { ...(await this.signTokens(payload)), user: payload };
  }

  /** Admin: email + password (scrypt, timing-safe). Internal staff only. */
  async adminLogin(email: string, password: string) {
    const db = this.prisma.db;
    const admin = await db.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    // Same error either way — never reveal whether the email exists.
    if (!admin || !admin.isActive || !verifyPassword(password, admin.passwordHash)) {
      throw new UnauthorizedException('Wrong email or password');
    }
    const payload: JwtPayload = { sub: admin.id, aud: 'ADMIN', phone: '' };
    return { ...(await this.signTokens(payload)), user: { ...payload, name: admin.name, role: admin.role } };
  }

  private async buildPayload(phone: string, audience: AuthAudience): Promise<JwtPayload> {
    const db = this.prisma.db;

    if (audience === 'CUSTOMER') {
      // First verify creates the account (FR-C-001) — phone IS the identity.
      const user = await db.user.upsert({
        where: { phone },
        update: {},
        create: { phone },
      });
      if (user.status === 'BLOCKED') throw new ForbiddenException('Account blocked — contact support');
      return { sub: user.id, aud: 'CUSTOMER', phone };
    }

    if (audience === 'DRIVER') {
      const driver = await db.driver.findUnique({ where: { phone } });
      if (!driver) throw new ForbiddenException('No driver account for this number');
      if (driver.status === 'SUSPENDED') throw new ForbiddenException('Account suspended — contact Admin');
      return { sub: driver.id, aud: 'DRIVER', phone, driverId: driver.id };
    }

    const store = await db.store.findFirst({ where: { phone } });
    if (!store) throw new ForbiddenException('No store account for this number');
    if (store.isBlocked) throw new ForbiddenException('Store blocked — contact Admin');
    return { sub: store.id, aud: 'POS', phone, storeId: store.id };
  }

  private async signTokens(payload: JwtPayload): Promise<AuthTokens> {
    // jti: every issued token is unique (JWTs are otherwise deterministic to
    // the second) and individually revocable when a denylist lands later.
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { ...payload, jti: randomUUID() },
        { secret: accessSecret, expiresIn: ACCESS_TTL },
      ),
      this.jwt.signAsync(
        { ...payload, typ: 'refresh', jti: randomUUID() },
        { secret: refreshSecret, expiresIn: REFRESH_TTL },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  // ── refresh ──────────────────────────────────────────────────────────
  async refresh(refreshToken: string) {
    let decoded: JwtPayload & { typ?: string };
    try {
      decoded = await this.jwt.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('Session expired — sign in again');
    }
    if (decoded.typ !== 'refresh') throw new UnauthorizedException('Invalid token');

    // Re-derive payload so blocks/suspensions applied since issue take effect.
    if (decoded.aud === 'ADMIN') {
      const admin = await this.prisma.db.adminUser.findUnique({ where: { id: decoded.sub } });
      if (!admin || !admin.isActive) throw new UnauthorizedException('Account disabled');
      const payload: JwtPayload = { sub: admin.id, aud: 'ADMIN', phone: '' };
      return { ...(await this.signTokens(payload)), user: payload };
    }
    const payload = await this.buildPayload(decoded.phone, decoded.aud);
    return { ...(await this.signTokens(payload)), user: payload };
  }

  async verifyAccess(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, { secret: accessSecret });
    } catch {
      throw new UnauthorizedException('Session expired');
    }
  }
}
