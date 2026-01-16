import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TermiiService {
  private readonly logger = new Logger(TermiiService.name);
  private readonly apiUrl = 'https://api.ng.termii.com/api/sms/send';

  constructor(private configService: ConfigService) {}

  private formatPhoneNumber(phone: string): string {
    // Remove any spaces or special characters
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // If starts with 0, replace with +234
    if (cleaned.startsWith('0')) {
      cleaned = '+234' + cleaned.substring(1);
    }

    // If doesn't start with +, add +234
    if (!cleaned.startsWith('+')) {
      cleaned = '+234' + cleaned;
    }

    return cleaned;
  }

  async sendSms(to: string, message: string): Promise<boolean> {
    const apiKey = this.configService.get<string>('TERMII_API_KEY');
    const senderId = this.configService.get<string>('TERMII_SENDER_ID');

    if (!apiKey) {
      this.logger.warn('TERMII_API_KEY not configured, skipping SMS');
      return false;
    }

    const formattedPhone = this.formatPhoneNumber(to);

    try {
      const response = await axios.post(this.apiUrl, {
        to: formattedPhone,
        from: senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: apiKey,
      });

      this.logger.log(`SMS sent to ${formattedPhone}: ${response.data.message}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${formattedPhone}:`, error.message);
      return false;
    }
  }

  async sendOtp(to: string, otp: string): Promise<boolean> {
    const message = `Your FinSquare verification code is: ${otp}. Valid for 15 minutes.`;
    return this.sendSms(to, message);
  }
}
