import nodemailer from 'nodemailer';
import { config } from './index';
import { logger } from './logger';

const hasAuth = !!(config.mail.user && config.mail.pass);

export const mailer = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.secure,
  auth: hasAuth ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

export async function verifyMailer() {
  // Skip verification if SMTP_USER/SMTP_PASS aren't set (dev mode)
  if (!hasAuth) {
    logger.warn('⚠️  Mailer skipped (no SMTP_USER / SMTP_PASS — dev mode)');
    return;
  }
  try {
    await mailer.verify();
    logger.info('✅ Mailer ready');
  } catch (err) {
    logger.warn('⚠️  Mailer verification failed (dev mode OK)', err);
  }
}
