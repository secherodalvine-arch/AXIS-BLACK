export type Currency = 'USD' | 'KES';

// Default exchange rate: 1 USD = 130 KES
export const USD_TO_KES_RATE = 130;

export const formatCurrency = (amountInUSD: number, currency: Currency): string => {
  const isNegative = amountInUSD < 0;
  const absAmountUSD = Math.abs(amountInUSD);

  if (currency === 'KES') {
    const amountKES = absAmountUSD * USD_TO_KES_RATE;
    let formatted = '';
    if (amountKES >= 1_000_000_000) {
      formatted = `KSh ${(amountKES / 1_000_000_000).toFixed(2)}B`;
    } else if (amountKES >= 1_000_000) {
      formatted = `KSh ${(amountKES / 1_000_000).toFixed(2)}M`;
    } else {
      formatted = `KSh ${amountKES.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return isNegative ? `-${formatted}` : formatted;
  }

  // USD
  let formatted = '';
  if (absAmountUSD >= 1_000_000_000) {
    formatted = `$${(absAmountUSD / 1_000_000_000).toFixed(2)}B`;
  } else if (absAmountUSD >= 1_000_000) {
    formatted = `$${(absAmountUSD / 1_000_000).toFixed(2)}M`;
  } else {
    formatted = `$${absAmountUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return isNegative ? `-${formatted}` : formatted;
};

export const getCurrencySymbol = (currency: Currency): string => {
  return currency === 'KES' ? 'KSh' : '$';
};

/**
 * Money is always STORED in USD (the base currency of the platform) and only
 * converted for display. These helpers convert between what the user sees/types
 * (their chosen currency) and what is stored.
 */
const roundTo = (n: number, places: number): number => {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
};

/** Stored USD amount -> number in the user's chosen currency (for showing inside input boxes). */
export const toDisplayAmount = (amountInUSD: number, currency: Currency): number => {
  const n = Number(amountInUSD) || 0;
  return currency === 'KES' ? roundTo(n * USD_TO_KES_RATE, 2) : roundTo(n, 2);
};

/** Number the user typed in their chosen currency -> USD amount to store. */
export const fromDisplayAmount = (amountInDisplayCurrency: number, currency: Currency): number => {
  const n = Number(amountInDisplayCurrency) || 0;
  return currency === 'KES' ? roundTo(n / USD_TO_KES_RATE, 6) : roundTo(n, 6);
};

/** Parses text typed by the user (allows commas and currency symbols) - returns NaN if not a number. */
export const parseMoneyInput = (text: string | number | null | undefined): number => {
  if (typeof text === 'number') return text;
  const cleaned = String(text ?? '').replace(/[^0-9.\-]+/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN;
  return parseFloat(cleaned);
};

/** Friendly currency name for form hints, e.g. "Kenya Shillings (KSh)". */
export const getCurrencyName = (currency: Currency): string => {
  return currency === 'KES' ? 'Kenya Shillings (KSh)' : 'US Dollars ($)';
};
