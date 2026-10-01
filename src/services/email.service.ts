import { mailer } from '../config/mailer';
import { config } from '../config';
import { logger } from '../config/logger';

const isDevNoSmtp =
  config.env === 'development' && !(config.mail.user && config.mail.pass);

logger.info('📧 EmailService mode: ' + (isDevNoSmtp ? 'DEV-LOG-ONLY' : 'REAL-SMTP'));

export class EmailService {
  private static async send(to: string, subject: string, html: string, text?: string) {
    const plain = text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (isDevNoSmtp) {
      logger.info('📧 [DEV EMAIL]', { to, subject });
      return;
    }

    try {
      await mailer.sendMail({ from: config.mail.from, to, subject, html, text: plain });
    } catch (err) {
      logger.error('Email send failed', { to, subject, err });
    }
  }

  static async sendOtp(to: string, code: string, purpose: string) {
    if (isDevNoSmtp) {
      logger.info('╔═══════════════════════════════════════════╗');
      logger.info('║  🔐 OTP CODE                              ║');
      logger.info('╠═══════════════════════════════════════════╣');
      logger.info('║  Email:   ' + to.padEnd(31) + '║');
      logger.info('║  Purpose: ' + purpose.padEnd(31) + '║');
      logger.info('║  Code:    ' + code.padEnd(31) + '║');
      logger.info('╚═══════════════════════════════════════════╝');
      return;
    }

    const subject =
      purpose === 'admin_login'
        ? 'Your QR CashBack admin login code'
        : 'Your QR CashBack verification code';

    const html = '<p>Your code is: <strong>' + code + '</strong></p>';
    await this.send(to, subject, html);
  }

  static async sendWelcome(to: string, name: string) {
    await this.send(to, 'Welcome', '<p>Welcome, ' + name + '</p>');
  }

  static async sendStaffCredentials(to: string, name: string, tempPassword: string) {
    if (isDevNoSmtp) {
      logger.info('📧 [DEV STAFF CREDS]', { to, name, tempPassword });
      return;
    }
    await this.send(to, 'Your QR CashBack seller account',
      '<p>Login: ' + to + ' / ' + tempPassword + '</p>');
  }

  static async sendWithdrawalResult(to: string, status: string, amount: string, reason?: string) {
    await this.send(to, 'Withdrawal ' + status, '<p>' + amount + ' ' + status + ' ' + (reason || '') + '</p>');
  }

  static async sendCashbackCredited(to: string, amount: string, newBalance: string) {
    await this.send(to, 'Cashback credited', '<p>' + amount + ' credited. Balance: ' + newBalance + '</p>');
  }

  static async sendOrderStatus(to: string, orderNumber: string, status: string) {
    await this.send(to, 'Order ' + orderNumber + ' - ' + status, '<p>Order is now ' + status + '</p>');
  }

  static async sendOrderFlagged(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    reason: string;
    total: string;
  }) {
    const subject = `Order #${params.orderNumber} needs your attention`;
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0B0F14">
        <h2 style="font-size:22px;margin:0 0 12px">Order flagged for review</h2>
        <p style="font-size:14px;line-height:1.6;color:#4B5563">
          Hi ${params.customerName}, we couldn't verify your payment for order
          <b>#${params.orderNumber}</b> (NGN ${params.total}).
        </p>
        <div style="margin:18px 0;padding:16px;background:#FEF2F2;border-left:4px solid #EF4444;border-radius:8px">
          <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#991B1B;margin:0 0 6px">
            Reason from our team
          </p>
          <p style="font-size:14px;line-height:1.6;margin:0;color:#7F1D1D">
            ${params.reason}
          </p>
        </div>
        <p style="font-size:14px;line-height:1.6;color:#4B5563">
          You can view the full details in your account. If you believe this is a
          mistake, please contact support — we'll take another look.
        </p>
        <p style="font-size:13px;color:#9CA3AF;margin-top:24px">
          — QR CashBack Connect
        </p>
      </div>
    `;
    await this.send(params.to, subject, html);
  }
}
