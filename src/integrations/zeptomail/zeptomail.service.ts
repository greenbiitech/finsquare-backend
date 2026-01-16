import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMailClient } from 'zeptomail';

@Injectable()
export class ZeptomailService {
  private readonly logger = new Logger(ZeptomailService.name);
  private readonly ZEPTO_URL = 'api.zeptomail.com/';

  constructor(private configService: ConfigService) {}

  async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
  ): Promise<boolean> {
    const token = this.configService.get<string>('ZEPTO_TOKEN');
    const fromEmail = this.configService.get<string>('ZEPTO_FROM_EMAIL') || 'noreply@greenbii.com';
    const fromName = this.configService.get<string>('ZEPTO_FROM_NAME') || 'FinSquare';

    if (!token) {
      this.logger.warn('ZEPTO_TOKEN not configured, skipping email');
      return false;
    }

    const client = new SendMailClient({ url: this.ZEPTO_URL, token });

    // Add timeout to prevent hanging
    const timeoutMs = 30000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email sending timed out after 30 seconds')), timeoutMs)
    );

    try {
      this.logger.log(`Sending email to: ${to}`);
      this.logger.log(`Subject: ${subject}`);

      const emailPromise = client.sendMail({
        from: {
          address: fromEmail,
          name: fromName,
        },
        to: [
          {
            email_address: {
              address: to,
              name: 'User',
            },
          },
        ],
        subject,
        htmlbody: htmlBody,
      });

      // Race between email send and timeout
      await Promise.race([emailPromise, timeoutPromise]);
      this.logger.log(`Email sent successfully to: ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error?.message || error);
      return false;
    }
  }

  async sendOtp(to: string, otp: string, userName?: string): Promise<boolean> {
    const subject = 'Your FinSquare Verification Code';
    const htmlBody = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Account Verification</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            color: #333333;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #4CAF50;
            margin: 20px 0;
            text-align: center;
            letter-spacing: 8px;
          }
          .message {
            font-size: 16px;
            color: #555555;
            text-align: center;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #aaaaaa;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="header">Verify Your Account</h2>
          <p class="message">Hello ${userName || 'there'},</p>
          <p class="message">Use the OTP below to verify your FinSquare account:</p>
          <div class="otp-code">${otp}</div>
          <p class="message">This OTP is valid for the next <strong>15 minutes</strong>. Please do not share it with anyone.</p>
          <div class="footer">
            If you didn't request this, you can ignore this email.
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(to, subject, htmlBody);
  }

  async sendCommunityInvite(
    to: string,
    inviterName: string,
    communityName: string,
    inviteLink: string,
    inviteeName?: string,
  ): Promise<boolean> {
    const subject = `You've been invited to join ${communityName} on FinSquare`;
    const htmlBody = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Community Invitation</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            color: #333333;
          }
          .community-name {
            font-size: 24px;
            font-weight: bold;
            color: #4CAF50;
            margin: 20px 0;
            text-align: center;
          }
          .message {
            font-size: 16px;
            color: #555555;
            text-align: center;
            line-height: 1.6;
          }
          .cta-button {
            display: block;
            width: 200px;
            margin: 30px auto;
            padding: 15px 30px;
            background-color: #4CAF50;
            color: #ffffff;
            text-align: center;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
          }
          .cta-button:hover {
            background-color: #45a049;
          }
          .link-text {
            font-size: 12px;
            color: #888888;
            text-align: center;
            word-break: break-all;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #aaaaaa;
            text-align: center;
          }
          .benefits {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .benefits ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .benefits li {
            padding: 8px 0;
            color: #555555;
            font-size: 14px;
          }
          .benefits li:before {
            content: "✓ ";
            color: #4CAF50;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="header">You're Invited! 🎉</h2>
          <p class="message">Hello ${inviteeName || 'there'},</p>
          <p class="message"><strong>${inviterName}</strong> has invited you to join:</p>
          <div class="community-name">${communityName}</div>
          <div class="benefits">
            <p class="message" style="text-align: left; margin-bottom: 10px;"><strong>As a member, you'll get access to:</strong></p>
            <ul>
              <li>Community Dues Collection</li>
              <li>Esusu (Rotational Savings)</li>
              <li>Group Buying Discounts</li>
              <li>Target Savings</li>
              <li>Cooperative Loans</li>
            </ul>
          </div>
          <a href="${inviteLink}" class="cta-button">Join Community</a>
          <p class="link-text">Or copy this link: ${inviteLink}</p>
          <div class="footer">
            This invitation was sent via FinSquare. If you didn't expect this, you can safely ignore it.
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(to, subject, htmlBody);
  }

  async sendCommunityCreated(
    to: string,
    communityName: string,
    creatorName: string,
    inviteLink: string,
  ): Promise<boolean> {
    const subject = `🎉 Your Community "${communityName}" Has Been Created!`;
    const htmlBody = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Community Created</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            color: #333333;
          }
          .community-name {
            font-size: 28px;
            font-weight: bold;
            color: #4CAF50;
            margin: 20px 0;
            text-align: center;
          }
          .message {
            font-size: 16px;
            color: #555555;
            text-align: center;
            line-height: 1.6;
          }
          .cta-button {
            display: block;
            width: 220px;
            margin: 30px auto;
            padding: 15px 30px;
            background-color: #4CAF50;
            color: #ffffff;
            text-align: center;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
          }
          .link-text {
            font-size: 12px;
            color: #888888;
            text-align: center;
            word-break: break-all;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #aaaaaa;
            text-align: center;
          }
          .next-steps {
            background-color: #e8f5e9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .next-steps h3 {
            color: #2e7d32;
            margin-top: 0;
            font-size: 16px;
          }
          .next-steps ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .next-steps li {
            padding: 8px 0;
            color: #555555;
            font-size: 14px;
          }
          .next-steps li:before {
            content: "→ ";
            color: #4CAF50;
            font-weight: bold;
          }
          .celebration {
            font-size: 48px;
            text-align: center;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="celebration">🎊</div>
          <h2 class="header">Congratulations, ${creatorName}!</h2>
          <p class="message">Your community has been successfully created on FinSquare:</p>
          <div class="community-name">${communityName}</div>
          <p class="message">You are now the <strong>Admin</strong> of this community.</p>
          <div class="next-steps">
            <h3>What's Next?</h3>
            <ul>
              <li>Share the invite link with your members</li>
              <li>Set up community dues and savings goals</li>
              <li>Explore group buying discounts</li>
              <li>Configure cooperative loan settings</li>
            </ul>
          </div>
          <a href="${inviteLink}" class="cta-button">Share Invite Link</a>
          <p class="link-text">Invite link: ${inviteLink}</p>
          <div class="footer">
            Need help? Contact our support team at support@finsquare.com
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(to, subject, htmlBody);
  }

  async sendWalletCreated(
    to: string,
    userName: string,
    accountNumber: string,
    accountName: string,
  ): Promise<boolean> {
    const subject = 'Your FinSquare Wallet is Ready!';
    const htmlBody = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Wallet Created</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            color: #333333;
          }
          .celebration {
            font-size: 48px;
            text-align: center;
            margin: 20px 0;
          }
          .account-box {
            background-color: #e8f5e9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .account-number {
            font-size: 28px;
            font-weight: bold;
            color: #2e7d32;
            letter-spacing: 2px;
            margin: 10px 0;
          }
          .account-name {
            font-size: 16px;
            color: #555555;
            margin-bottom: 5px;
          }
          .message {
            font-size: 16px;
            color: #555555;
            text-align: center;
            line-height: 1.6;
          }
          .features {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .features h3 {
            color: #333333;
            margin-top: 0;
            font-size: 16px;
          }
          .features ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .features li {
            padding: 8px 0;
            color: #555555;
            font-size: 14px;
          }
          .features li:before {
            content: "✓ ";
            color: #4CAF50;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #aaaaaa;
            text-align: center;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #856404;
            text-align: center;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="celebration">🎉</div>
          <h2 class="header">Congratulations, ${userName}!</h2>
          <p class="message">Your FinSquare wallet has been successfully created and is ready to use.</p>
          <div class="account-box">
            <div class="account-name">${accountName}</div>
            <div class="account-number">${accountNumber}</div>
            <div style="font-size: 12px; color: #888;">Your Account Number</div>
          </div>
          <div class="features">
            <h3>What You Can Do Now:</h3>
            <ul>
              <li>Fund your wallet via bank transfer</li>
              <li>Participate in community finance activities</li>
              <li>Join Esusu (rotational savings)</li>
              <li>Pay community dues</li>
              <li>Access group buying discounts</li>
            </ul>
          </div>
          <div class="warning">
            Keep your account number and transaction PIN safe. Never share your PIN with anyone.
          </div>
          <div class="footer">
            Need help? Contact our support team at support@finsquare.com
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(to, subject, htmlBody);
  }

  async sendPasswordResetOtp(to: string, otp: string, userName?: string): Promise<boolean> {
    const subject = 'Reset Your FinSquare Password';
    const htmlBody = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Password Reset</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            color: #333333;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #1a73e8;
            margin: 20px 0;
            text-align: center;
            letter-spacing: 8px;
          }
          .message {
            font-size: 16px;
            color: #555555;
            text-align: center;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #aaaaaa;
            text-align: center;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #856404;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="header">Password Reset Request</h2>
          <p class="message">Hello ${userName || 'there'},</p>
          <p class="message">We received a request to reset your password. Use the OTP below to proceed:</p>
          <div class="otp-code">${otp}</div>
          <p class="message">This OTP is valid for the next <strong>15 minutes</strong>.</p>
          <div class="warning">
            If you didn't request this password reset, please ignore this email and ensure your account is secure.
          </div>
          <div class="footer">
            This is an automated message from FinSquare. Please do not reply to this email.
          </div>
        </div>
      </body>
      </html>
    `;
    return this.sendEmail(to, subject, htmlBody);
  }
}
