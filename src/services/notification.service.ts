/**
 * Placeholder for future push/websocket notifications.
 * For now: writes to log only. The email service handles user-facing messages.
 */
import { logger } from '../config/logger';

export class NotificationService {
  static async notifyUser(userId: string, event: string, payload?: Record<string, unknown>) {
    logger.info('notify', { userId, event, payload });
  }

  static async notifyAdmin(event: string, payload?: Record<string, unknown>) {
    logger.info('notify-admin', { event, payload });
  }
}
