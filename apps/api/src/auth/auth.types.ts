/** Who is logged in. CUSTOMER/DRIVER/POS sign in by phone OTP; ADMIN by email+password. */
export type AuthAudience = 'CUSTOMER' | 'DRIVER' | 'POS' | 'ADMIN';

export interface JwtPayload {
  /** User.id / Driver.id / Store.id depending on audience. */
  sub: string;
  aud: AuthAudience;
  phone: string;
  /** POS only — the store this operator runs. */
  storeId?: string;
  /** DRIVER only. */
  driverId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
