import { mailer } from '../config/mailer';
import { config } from '../config';
import { logger } from '../config/logger';

/* ═══════════════════════════════════════════════════════════
   Brand assets — the logo is served from the storefront
═══════════════════════════════════════════════════════════ */
const LOGO_URL = 'https://vickkyaku.store/vickkyaku.png';
const BRAND_NAME = 'Vickkyaku';

function escapeHtml(s: string): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

/* ═══════════════════════════════════════════════════════════
   Shared email shell — logo header + branded footer
   Every email is wrapped in this unless { raw: true } is passed.
═══════════════════════════════════════════════════════════ */
function buildShell(contentHtml: string): string {
  return `
    <div style="margin:0;padding:32px 16px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0B0F14">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.06),0 1px 2px rgba(15,23,42,.04)">

        <!-- HEADER — logo -->
        <div style="padding:28px 24px 22px;text-align:center;background:linear-gradient(180deg,#ffffff 0%,#fafbfc 100%);border-bottom:1px solid #EEF1F4">
          <img
            src="${LOGO_URL}"
            alt="${BRAND_NAME}"
            style="display:inline-block;height:48px;width:auto;max-width:200px;border:0;outline:none;text-decoration:none"
          />
        </div>

        <!-- BODY -->
        <div style="padding:28px 24px">
          ${contentHtml}
        </div>

        <!-- FOOTER -->
        <div style="padding:20px 24px;text-align:center;border-top:1px solid #EEF1F4;background:#fafbfc">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#94A3B8">
            ${BRAND_NAME} — Nigerian local food, delivered
          </p>
          <p style="margin:0;font-size:11px;color:#B8C0CC">
            © ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  `;
}

const isDevNoSmtp =
  config.env === 'development' && !(config.mail.user && config.mail.pass);

logger.info('📧 EmailService mode: ' + (isDevNoSmtp ? 'DEV-LOG-ONLY' : 'REAL-SMTP'));

export class EmailService {
  /**
   * Core send. Wraps the content in the branded shell unless
   * `raw: true` is passed.
   */
  private static async send(
    to: string,
    subject: string,
    contentHtml: string,
    opts: { text?: string; raw?: boolean } = {}
  ) {
    const fullHtml = opts.raw ? contentHtml : buildShell(contentHtml);
    const plain =
      opts.text ??
      fullHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (isDevNoSmtp) {
      logger.info('📧 [DEV EMAIL]', { to, subject });
      return;
    }

    try {
      await mailer.sendMail({
        from: config.mail.from,
        to,
        subject,
        html: fullHtml,
        text: plain,
      });
    } catch (err) {
      logger.error('Email send failed', { to, subject, err });
    }
  }

  /* ═══════════════════════════════════════════════════════
     OTP
  ═══════════════════════════════════════════════════════ */
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
        ? 'Your Vickkyaku admin login code'
        : 'Your Vickkyaku verification code';

    const heading =
      purpose === 'admin_login' ? 'Admin login verification' : 'Verify your email';

    const content = `
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0B0F14">${heading}</h2>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4B5563">
        Enter the code below to continue. It expires in ${config.business.otpTtlMinutes} minutes.
      </p>
      <div style="padding:24px;background:#F0FDF4;border-radius:12px;text-align:center;border:1px solid #BBF7D0">
        <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#15803D">
          Your code
        </p>
        <p style="margin:0;font-size:36px;font-weight:900;letter-spacing:.18em;color:#0B0F14;font-family:'SF Mono',Menlo,monospace">
          ${escapeHtml(code)}
        </p>
      </div>
      <p style="margin:24px 0 0;font-size:12.5px;color:#9CA3AF">
        If you didn't request this code, you can safely ignore this email.
      </p>
    `;
    await this.send(to, subject, content);
  }

  /* ═══════════════════════════════════════════════════════
     Welcome
  ═══════════════════════════════════════════════════════ */
  static async sendWelcome(to: string, name: string) {
    const content = `
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0B0F14">Welcome, ${escapeHtml(name)}</h2>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#4B5563">
        You're all set on Vickkyaku. Start shopping authentic Nigerian food and earn cashback on every sealed pack.
      </p>
    `;
    await this.send(to, 'Welcome to Vickkyaku', content);
  }

  /* ═══════════════════════════════════════════════════════
     Staff credentials
  ═══════════════════════════════════════════════════════ */
  static async sendStaffCredentials(to: string, name: string, tempPassword: string) {
    if (isDevNoSmtp) {
      logger.info('📧 [DEV STAFF CREDS]', { to, name, tempPassword });
      return;
    }
    const content = `
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0B0F14">Your seller account is ready</h2>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4B5563">
        Hi ${escapeHtml(name)}, here are your login details.
      </p>
      <div style="padding:16px;background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#64748B">EMAIL</p>
        <p style="margin:0 0 14px;font-size:14px;font-family:monospace;color:#0B0F14">${escapeHtml(to)}</p>
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#64748B">TEMPORARY PASSWORD</p>
        <p style="margin:0;font-size:14px;font-family:monospace;color:#0B0F14">${escapeHtml(tempPassword)}</p>
      </div>
      <p style="margin:20px 0 0;font-size:12.5px;color:#9CA3AF">
        You'll be asked to change this password on first login.
      </p>
    `;
    await this.send(to, 'Your Vickkyaku seller account', content);
  }

  /* ═══════════════════════════════════════════════════════
     Withdrawal result
  ═══════════════════════════════════════════════════════ */
  static async sendWithdrawalResult(
    to: string,
    status: string,
    amount: string,
    reason?: string
  ) {
    const approved = status === 'approved';
    const content = `
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0B0F14">
        Withdrawal ${escapeHtml(status)}
      </h2>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4B5563">
        Your withdrawal of <b style="color:#0B0F14">₦${escapeHtml(amount)}</b> has been ${escapeHtml(status)}.
      </p>
      ${reason ? `
        <div style="padding:14px 16px;background:${approved ? '#F0FDF4' : '#FEF2F2'};border-left:4px solid ${approved ? '#16A34A' : '#EF4444'};border-radius:8px">
          <p style="margin:0;font-size:13.5px;color:${approved ? '#166534' : '#991B1B'}">
            ${escapeHtml(reason)}
          </p>
        </div>
      ` : ''}
    `;
    await this.send(to, 'Withdrawal ' + status, content);
  }

  /* ═══════════════════════════════════════════════════════
     Cashback credited
  ═══════════════════════════════════════════════════════ */
  static async sendCashbackCredited(to: string, amount: string, newBalance: string) {
    const content = `
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0B0F14">Cashback credited 🎉</h2>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4B5563">
        You just earned <b style="color:#16A34A">₦${escapeHtml(amount)}</b> cashback.
      </p>
      <div style="padding:20px;background:#F0FDF4;border-radius:12px;border:1px solid #BBF7D0">
        <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#15803D">
          New wallet balance
        </p>
        <p style="margin:0;font-size:24px;font-weight:900;color:#0B0F14">
          ₦${escapeHtml(newBalance)}
        </p>
      </div>
    `;
    await this.send(to, 'Cashback credited', content);
  }

  /* ═══════════════════════════════════════════════════════
     Order status
  ═══════════════════════════════════════════════════════ */
  static async sendOrderStatus(to: string, orderNumber: string, status: string) {
    const content = `
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0B0F14">Order update</h2>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4B5563">
        Order <b style="color:#0B0F14">#${escapeHtml(orderNumber)}</b> is now
        <b style="color:#0B0F14">${escapeHtml(status)}</b>.
      </p>
    `;
    await this.send(to, 'Order ' + orderNumber + ' - ' + status, content);
  }

  /* ═══════════════════════════════════════════════════════
     Order flagged
  ═══════════════════════════════════════════════════════ */
  static async sendOrderFlagged(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    reason: string;
    total: string;
  }) {
    const subject = `Order #${params.orderNumber} needs your attention`;
    const content = `
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0B0F14">Order flagged for review</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4B5563">
        Hi ${escapeHtml(params.customerName)}, we couldn't verify your payment for order
        <b>#${escapeHtml(params.orderNumber)}</b> (₦${escapeHtml(params.total)}).
      </p>
      <div style="margin:18px 0;padding:16px;background:#FEF2F2;border-left:4px solid #EF4444;border-radius:8px">
        <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#991B1B;margin:0 0 6px">
          Reason from our team
        </p>
        <p style="font-size:14px;line-height:1.6;margin:0;color:#7F1D1D">
          ${escapeHtml(params.reason)}
        </p>
      </div>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#4B5563">
        You can view the full details in your account. If you believe this is a
        mistake, please contact support — we'll take another look.
      </p>
    `;
    await this.send(params.to, subject, content);
  }

  /* ═══════════════════════════════════════════════════════
     Package status
  ═══════════════════════════════════════════════════════ */
  static async sendPackageStatus(to: string, reference: string, status: string) {
    const label = status.replace('_', ' ');
    const content = `
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0B0F14">Package update</h2>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#4B5563">
        Update on your special-order list <b>#${escapeHtml(reference)}</b>:
        the status is now <b>${escapeHtml(label)}</b>.
      </p>
    `;
    await this.send(to, `Your package #${reference} is now ${label}`, content);
  }

  /* ═══════════════════════════════════════════════════════
     Package edit decision
  ═══════════════════════════════════════════════════════ */
  static async sendPackageEditDecision(
    to: string,
    reference: string,
    decision: 'approved' | 'denied'
  ) {
    const approved = decision === 'approved';
    const content = `
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0B0F14">
        Edit request ${escapeHtml(decision)}
      </h2>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#4B5563">
        ${approved
          ? `Your edit request for <b>#${escapeHtml(reference)}</b> was approved. You can now update the list.`
          : `Your edit request for <b>#${escapeHtml(reference)}</b> was declined. Check the chat for details.`}
      </p>
    `;
    await this.send(
      to,
      approved
        ? `Edit approved for #${reference}`
        : `Edit request declined for #${reference}`,
      content
    );
  }

  /* ═══════════════════════════════════════════════════════
     ADMIN ALERT — notification to the admin inbox
  ═══════════════════════════════════════════════════════ */
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

    const content = `
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
        You're receiving this because admin alerts are enabled in your Vickkyaku settings.
      </p>
    `;

    const subject = `[Vickkyaku] ${kindLabel} — ${opts.title}`;
    await this.send(opts.to, subject, content);
  }
}