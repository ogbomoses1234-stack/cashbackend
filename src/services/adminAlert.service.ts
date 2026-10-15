import { config } from '../config';
import { logger } from '../config/logger';
import {
  NotificationPreferencesService,
  type AdminNotificationKind,
} from './notificationPreferences.service';
import { EmailService } from './email.service';

export interface AdminAlertInput {
  kind: AdminNotificationKind;
  title: string;
  lines: Array<{ label: string; value: string }>;
  ctaPath?: string;
  ctaLabel?: string;
}

function adminBaseUrl(): string {
  const raw = config.domains.admin;
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export class AdminAlertService {
  /**
   * Fire-and-forget admin notification.
   * Never throws — callers still use `.catch(() => {})`.
   */
  static async notify(input: AdminAlertInput): Promise<void> {
    try {
      const prefs = await NotificationPreferencesService.get();

      if (!prefs[input.kind]) return; // toggle disabled
      if (!prefs.email) {
        logger.warn('Admin alert skipped — no notify email configured', {
          kind: input.kind,
        });
        return;
      }

      const ctaUrl =
        input.ctaPath && input.ctaPath.length > 0
          ? `${adminBaseUrl().replace(/\/$/, '')}${input.ctaPath}`
          : undefined;

      await EmailService.sendAdminAlert({
        to: prefs.email,
        title: input.title,
        lines: input.lines,
        ctaUrl,
        ctaLabel: input.ctaLabel ?? 'Open in dashboard',
        kind: input.kind,
      });
    } catch (err) {
      logger.warn('AdminAlertService.notify failed', { kind: input.kind, err });
    }
  }
}