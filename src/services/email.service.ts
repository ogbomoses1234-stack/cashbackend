import { mailer } from '../config/mailer';
import { config } from '../config';
import { logger } from '../config/logger';

function escapeHtml(s: string): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

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

  static async sendPackageStatus(to: string, reference: string, status: string) {
    const label = status.replace('_', ' ');
    await this.send(
      to,
      `Your package #${reference} is now ${label}`,
      `<p>Update on your special-order list <b>#${reference}</b>: the status is now <b>${label}</b>.</p>`
    );
  }

  static async sendPackageEditDecision(
    to: string,
    reference: string,
    decision: 'approved' | 'denied'
  ) {
    await this.send(
      to,
      decision === 'approved'
        ? `Edit approved for #${reference}`
        : `Edit request declined for #${reference}`,
      decision === 'approved'
        ? `<p>Your edit request for <b>#${reference}</b> was approved. You can now update the list.</p>`
        : `<p>Your edit request for <b>#${reference}</b> was declined. Check the chat for details.</p>`
    );
  }

  static async sendAdminAlert(opts: {
    to: string;
    kind: 'order' | 'package' | 'withdrawal';
    title: string;
    lines: Array<{ label: string; value: string }>;
    ctaUrl?: string;
    ctaLabel?: string;
  }) {
    const kindLabel =
      opts.kind === 'order'
        ? 'New order'
        : opts.kind === 'package'
        ? 'Special package request'
        : 'Withdrawal request';

    const accent = opts.kind === 'withdrawal' ? '#B45309' : '#0F766E';

    const rows = opts.lines
      .map(
        (l) => `
          <tr>
            <td style="padding:8px 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;width:38%;vertical-align:top">
              ${escapeHtml(l.label)}
            </td>
            <td style="padding:8px 0;font-size:14px;color:#111827;line-height:1.5;vertical-align:top">
              ${escapeHtml(l.value)}
            </td>
          </tr>`
      )
      .join('');

    const cta = opts.ctaUrl
      ? `<a href="${opts.ctaUrl}"
           style="display:inline-block;margin-top:20px;padding:12px 22px;background:${accent};color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
           ${escapeHtml(opts.ctaLabel ?? 'Open in dashboard')}
         </a>`
      : '';

    const subject = `[QR CashBack] ${kindLabel} — ${opts.title}`;

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0B0F14">
        <div style="display:inline-block;padding:4px 10px;background:${accent};color:#fff;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">
          ${escapeHtml(kindLabel)}
        </div>
        <h2 style="font-size:22px;margin:14px 0 8px;color:#0B0F14">${escapeHtml(opts.title)}</h2>
        <p style="font-size:13px;color:#6B7280;margin:0 0 18px">
          ${new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB">
          ${rows}
        </table>
        ${cta}
        <p style="font-size:12px;color:#9CA3AF;margin-top:28px">
          You're receiving this because admin alerts are enabled in your QR CashBack settings.
        </p>
      </div>
    `;

    await this.send(opts.to, subject, html);
  }

}