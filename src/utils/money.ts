import { Prisma } from '@prisma/client';

export function toMoney(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function formatNaira(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return 'NGN ' + num.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}
