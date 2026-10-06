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

/**
 * Pastille avec les initiales du titulaire (aucune photo : on n'affiche jamais le visage d'une
 * autre personne, ce qui tromperait l'agent au portique).
 */
export function initialsAvatar(name: string): string {
  const initials = (name || '?')
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('') || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#e0f2fe"/><text x="32" y="40" font-family="sans-serif" font-size="24" font-weight="700" text-anchor="middle" fill="#0c4a6e">${initials.replace(/[<&>]/g, '')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
