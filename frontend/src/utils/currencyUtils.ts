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
