export const UPLOAD_RULES = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_MIME: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  ALLOWED_EXT: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
  RECEIPT_MAX_PER_HOUR: 5,
  DISPUTE_MAX_PER_HOUR: 3,
  CHAT_ATTACHMENT_MAX_PER_HOUR: 10,
} as const;

export const MEDIA_NAMESPACES = {
  RECEIPTS: 'receipts',
  DISPUTES: 'disputes',
  CHAT: 'chat-attachments',
  QR_ARCHIVES: 'qr-archives',
  PRODUCTS: 'products',
  AVATARS: 'avatars',
} as const;

export const OTP_RESEND_WINDOW_SECONDS = 60;
export const OTP_MAX_RESENDS_PER_HOUR = 3;
export const ADMIN_SESSION_TTL_MINUTES = 15;
export const ADMIN_MAX_FAILED_ATTEMPTS = 5;
export const ADMIN_LOCKOUT_MINUTES = 15;
export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MINUTES = 15;
