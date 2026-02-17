// KRW Exchange Rate Configuration
export const KRW_RATE = 1350;

/**
 * Convert USD price to KRW
 */
export function toKRW(usdPrice: number): number {
  return usdPrice * KRW_RATE;
}

/**
 * Format KRW amount with ₩ prefix and thousand separators
 */
export function formatKRW(usdPrice: number, options?: { maximumFractionDigits?: number }): string {
  const krw = toKRW(usdPrice);
  return `₩${krw.toLocaleString('ko-KR', { maximumFractionDigits: options?.maximumFractionDigits ?? 0 })}`;
}

/**
 * Format already-KRW amount (no conversion needed)
 */
export function formatKRWRaw(krwAmount: number, options?: { maximumFractionDigits?: number }): string {
  return `₩${krwAmount.toLocaleString('ko-KR', { maximumFractionDigits: options?.maximumFractionDigits ?? 0 })}`;
}
