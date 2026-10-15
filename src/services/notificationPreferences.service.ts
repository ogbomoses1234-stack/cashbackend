import { prisma } from '../config/database';
import { config } from '../config';

export type AdminNotificationKind = 'order' | 'package' | 'withdrawal';

/* SystemSetting keys */
const KEYS: Record<AdminNotificationKind, string> = {
  order: 'admin_notify_order',
  package: 'admin_notify_package',
  withdrawal: 'admin_notify_withdrawal',
};
const EMAIL_KEY = 'admin_notify_email';

/* Defaults when nothing is stored yet */
const DEFAULTS: Record<AdminNotificationKind, boolean> = {
  order: true,
  package: true,
  withdrawal: true,
};

export interface NotificationPreferences {
  order: boolean;
  package: boolean;
  withdrawal: boolean;
  email: string;
}

export class NotificationPreferencesService {
  static async get(): Promise<NotificationPreferences> {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: [...Object.values(KEYS), EMAIL_KEY] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const readBool = (kind: AdminNotificationKind): boolean => {
      const raw = map.get(KEYS[kind]);
      if (raw === undefined) return DEFAULTS[kind];
      return raw === 'true';
    };

    return {
      order: readBool('order'),
      package: readBool('package'),
      withdrawal: readBool('withdrawal'),
      email: (map.get(EMAIL_KEY) || '').trim() || config.mail.adminNotifyEmail,
    };
  }

  static async isEnabled(kind: AdminNotificationKind): Promise<boolean> {
    const prefs = await this.get();
    return prefs[kind];
  }

  static async update(
    patch: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const ops: Array<{ key: string; value: string }> = [];

    if (patch.order !== undefined) ops.push({ key: KEYS.order, value: String(patch.order) });
    if (patch.package !== undefined) ops.push({ key: KEYS.package, value: String(patch.package) });
    if (patch.withdrawal !== undefined)
      ops.push({ key: KEYS.withdrawal, value: String(patch.withdrawal) });
    if (patch.email !== undefined) ops.push({ key: EMAIL_KEY, value: patch.email.trim() });

    if (ops.length === 0) return this.get();

    await prisma.$transaction(
      ops.map((op) =>
        prisma.systemSetting.upsert({
          where: { key: op.key },
          create: { key: op.key, value: op.value },
          update: { value: op.value },
        })
      )
    );

    return this.get();
  }
}