import { CurrencyCode, StoreSettings } from '../types';

export function convertFromUSD(
  amountUSD: number,
  currency: CurrencyCode,
  rates: StoreSettings['rates']
): number {
  const rate = rates[currency] || 1;
  return amountUSD * rate;
}

export function convertToUSD(
  amountInCurrency: number,
  currency: CurrencyCode,
  rates: StoreSettings['rates']
): number {
  const rate = rates[currency] || 1;
  return rate > 0 ? amountInCurrency / rate : amountInCurrency;
}

export function formatMoney(
  amountUSD: number,
  currency: CurrencyCode,
  rates: StoreSettings['rates']
): string {
  const converted = convertFromUSD(amountUSD, currency, rates);

  if (currency === 'USD') {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted);
  }

  if (currency === 'EUR') {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted);
  }

  if (currency === 'CDF') {
    return `${Math.round(converted).toLocaleString('fr-FR')} FC`;
  }

  if (currency === 'XOF') {
    return `${Math.round(converted).toLocaleString('fr-FR')} FCFA`;
  }

  return `${converted.toFixed(2)} ${currency}`;
}

export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}
