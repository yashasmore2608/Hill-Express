import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthAudience, JwtPayload } from './auth.types';

const AUDIENCE_KEY = 'auth:audiences';

/** Restrict a route to specific audiences: @Audiences('DRIVER') */
export const Audiences = (...audiences: AuthAudience[]) => SetMetadata(AUDIENCE_KEY, audiences);

/** Injects the verified JWT payload: fn(@CurrentUser() user: JwtPayload) */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
  return req.user;
});

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Sign in required');

    const payload = await this.auth.verifyAccess(header.slice(7));

    const allowed = this.reflector.getAllAndOverride<AuthAudience[] | undefined>(AUDIENCE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowed && allowed.length > 0 && !allowed.includes(payload.aud)) {
      throw new ForbiddenException('Not allowed for this account type');
    }

    req.user = payload;
    return true;
  }
}
