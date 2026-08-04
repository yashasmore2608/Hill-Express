import { Injectable, Logger } from '@nestjs/common';

/**
 * SMS is behind an interface from day one — swapping in MSG91 (or Twilio)
 * at launch is one new class + one provider binding, zero call-site changes.
 */
export abstract class SmsProvider {
  abstract sendOtp(phone: string, otp: string): Promise<void>;
}

/** Dev provider: the OTP goes to the API console, not a phone. */
@Injectable()
export class ConsoleSmsProvider extends SmsProvider {
  private readonly logger = new Logger('SMS');

  async sendOtp(phone: string, otp: string): Promise<void> {
    this.logger.log(`OTP for ${phone}: ${otp}`);
  }
}
