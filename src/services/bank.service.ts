import axios from 'axios';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';

/**
 * Detect placeholder Paystack keys (e.g. "sk_test_xxxxx") so we don't
 * call the real API and get a 401 during local development.
 */
function hasRealPaystackKey(): boolean {
  const key = config.paystack.secretKey || '';
  if (!key) return false;
  // Placeholder markers
  if (key.includes('xxxxx')) return false;
  if (key === 'sk_test_xxxxx' || key === 'sk_live_xxxx') return false;
  // Paystack keys are usually sk_test_<40+ chars> or sk_live_<40+ chars>
  if (!/^sk_(test|live)_[A-Za-z0-9]{20,}$/.test(key)) return false;
  return true;
}


const PAYSTACK_BASE = 'https://api.paystack.co';

interface PaystackBank {
  name: string;
  code: string;
  slug: string;
}

export class BankService {
  /** Return the list of Nigerian banks from Paystack. Cached for 24h in memory. */
  private static cache: { at: number; banks: PaystackBank[] } | null = null;

  static async listBanks(): Promise<PaystackBank[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < 24 * 60 * 60 * 1000) return this.cache.banks;

    if (!hasRealPaystackKey()) {
      // Fallback hardcoded list for local development
      const fallback: PaystackBank[] = [
        { name: 'Access Bank', code: '044', slug: 'access-bank' },
        { name: 'Citibank Nigeria', code: '023', slug: 'citibank-nigeria' },
        { name: 'Ecobank Nigeria', code: '050', slug: 'ecobank-nigeria' },
        { name: 'Fidelity Bank', code: '070', slug: 'fidelity-bank' },
        { name: 'First Bank of Nigeria', code: '011', slug: 'first-bank-of-nigeria' },
        { name: 'First City Monument Bank', code: '214', slug: 'first-city-monument-bank' },
        { name: 'Guaranty Trust Bank', code: '058', slug: 'guaranty-trust-bank' },
        { name: 'Heritage Bank', code: '030', slug: 'heritage-bank' },
        { name: 'Keystone Bank', code: '082', slug: 'keystone-bank' },
        { name: 'Polaris Bank', code: '076', slug: 'polaris-bank' },
        { name: 'Providus Bank', code: '101', slug: 'providus-bank' },
        { name: 'Stanbic IBTC Bank', code: '221', slug: 'stanbic-ibtc-bank' },
        { name: 'Standard Chartered Bank', code: '068', slug: 'standard-chartered-bank' },
        { name: 'Sterling Bank', code: '232', slug: 'sterling-bank' },
        { name: 'Union Bank of Nigeria', code: '032', slug: 'union-bank-of-nigeria' },
        { name: 'United Bank For Africa', code: '033', slug: 'united-bank-for-africa' },
        { name: 'Unity Bank', code: '215', slug: 'unity-bank' },
        { name: 'Wema Bank', code: '035', slug: 'wema-bank' },
        { name: 'Zenith Bank', code: '057', slug: 'zenith-bank' },
      ];
      this.cache = { at: now, banks: fallback };
      return fallback;
    }

    try {
      const { data } = await axios.get(`${PAYSTACK_BASE}/bank?country=nigeria&currency=NGN`, {
        headers: { Authorization: `Bearer ${config.paystack.secretKey}` },
      });
      const banks = (data.data as PaystackBank[]) || [];
      this.cache = { at: now, banks };
      return banks;
    } catch {
      throw ApiError.internal('BANK_LIST_FAILED', 'Could not fetch bank list');
    }
  }

  /** Resolve account number → account name via Paystack. */
  static async resolveAccount(accountNumber: string, bankCode: string) {
    if (!/^\d{10}$/.test(accountNumber)) {
      throw ApiError.badRequest('PAYOUT_INVALID_ACCOUNT', 'Account number must be 10 digits');
    }

    if (!hasRealPaystackKey()) {
      // Dev fallback
      return { accountName: 'DEV ACCOUNT (no Paystack key)', accountNumber };
    }

    try {
      const { data } = await axios.get(
        `${PAYSTACK_BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        { headers: { Authorization: `Bearer ${config.paystack.secretKey}` } }
      );
      return {
        accountName: data.data.account_name as string,
        accountNumber: data.data.account_number as string,
      };
    } catch (err: any) {
      throw ApiError.badRequest(
        'PAYOUT_RESOLVE_FAILED',
        err?.response?.data?.message || 'Could not resolve account'
      );
    }
  }
}
