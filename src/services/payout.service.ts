import axios from 'axios';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';

/**
 * Detect placeholder Paystack keys (sk_test_xxxxx etc).
 */
function hasRealPaystackKey(): boolean {
  const key = config.paystack.secretKey || '';
  if (!key) return false;
  if (key.includes('xxxxx')) return false;
  if (!/^sk_(test|live)_[A-Za-z0-9]{20,}$/.test(key)) return false;
  return true;
}


const PAYSTACK_BASE = 'https://api.paystack.co';

interface TransferResult {
  reference: string;
  status: 'success' | 'pending' | 'failed';
  provider: 'paystack' | 'dev';
}

/**
 * Payout processor — currently Paystack.
 * In dev (no secret key), returns a fake success so flows can be tested end-to-end.
 */
export class PayoutService {
  static async sendPayout(opts: {
    amountNaira: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    reason: string;
  }): Promise<TransferResult> {
    if (!hasRealPaystackKey()) {
      logger.warn('PayoutService: no Paystack key — returning dev-simulated payout');
      return {
        reference: `DEV-${Date.now()}`,
        status: 'success',
        provider: 'dev',
      };
    }

    try {
      // 1. Create transfer recipient
      const recipientResp = await axios.post(
        `${PAYSTACK_BASE}/transferrecipient`,
        {
          type: 'nuban',
          name: opts.accountName,
          account_number: opts.accountNumber,
          bank_code: opts.bankCode,
          currency: 'NGN',
        },
        { headers: { Authorization: `Bearer ${config.paystack.secretKey}` } }
      );
      const recipientCode = recipientResp.data.data.recipient_code;

      // 2. Initiate transfer
      const transferResp = await axios.post(
        `${PAYSTACK_BASE}/transfer`,
        {
          source: 'balance',
          amount: Math.round(opts.amountNaira * 100), // kobo
          recipient: recipientCode,
          reason: opts.reason,
        },
        { headers: { Authorization: `Bearer ${config.paystack.secretKey}` } }
      );

      const transfer = transferResp.data.data;
      return {
        reference: transfer.reference,
        status: transfer.status === 'success' ? 'success' : 'pending',
        provider: 'paystack',
      };
    } catch (err: any) {
      logger.error('Payout failed', { err: err?.response?.data || err.message });
      throw ApiError.internal(
        'PAYOUT_FAILED',
        err?.response?.data?.message || 'Payout provider rejected the transfer'
      );
    }
  }
}
