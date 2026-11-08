/**
 * Centralized formatting utilities for Indian Currency, Dates, and Member Identities.
 * Ensures 100% consistent UX across iOS, Android, Desktop, and PWA platforms.
 */

export interface FormatCurrencyOptions {
  /** Include ₹ symbol (default: false) */
  symbol?: boolean;
  /** Maximum fraction digits (default: 2) */
  maximumFractionDigits?: number;
  /** Minimum fraction digits (default: 0) */
  minimumFractionDigits?: number;
  /** Force rounded whole number (default: false) */
  round?: boolean;
}

/**
 * Formats a number to Indian numbering system (e.g., 1,50,000.50).
 */
export function formatINR(amount: number | string | null | undefined, options: FormatCurrencyOptions = {}): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || '0'));
  if (isNaN(num)) return options.symbol ? '₹0' : '0';

  const {
    symbol = false,
    round = false,
    maximumFractionDigits = round ? 0 : 2,
    minimumFractionDigits = 0
  } = options;

  const targetNum = round ? Math.round(num) : num;
  const isNegative = targetNum < 0;
  const absNum = Math.abs(targetNum);

  const formatted = absNum.toLocaleString('en-IN', {
    maximumFractionDigits,
    minimumFractionDigits
  });

  if (symbol) {
    return isNegative ? `-₹${formatted}` : `₹${formatted}`;
  }

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formats date into Indian locale standard representation.
 */
export function formatIndianDate(
  dateInput: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
): string {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString('en-IN', options);
}

/**
 * Resolves a member or user object to their canonical display name.
 * Fallback chain: displayName -> email prefix -> fallback label ('Member' / 'User')
 */
export function getMemberDisplayName(
  member: { displayName?: string | null; name?: string | null; email?: string | null } | null | undefined,
  fallback = 'Member'
): string {
  if (!member) return fallback;
  const name = member.displayName || member.name;
  if (name && name.trim()) return name.trim();
  if (member.email && member.email.includes('@')) {
    const prefix = member.email.split('@')[0];
    if (prefix && prefix.trim()) return prefix.trim();
  }
  return fallback;
}
