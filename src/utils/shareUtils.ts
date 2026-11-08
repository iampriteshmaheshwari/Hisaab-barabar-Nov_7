import type { ExpenseGroup } from '../types';

/**
 * Generates the standardized invite URL for any ledger group.
 * Matches the canonical pattern used across the web app.
 */
export function getGroupInviteUrl(group: ExpenseGroup | { id: string; name?: string; inviteCode?: string; type?: string }): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const code = group.inviteCode || group.id;
  const isSplit = group.type === 'split';
  const typeParam = isSplit ? '&type=split' : '&type=budget';
  const nameParam = ('name' in group && group.name) ? `&name=${encodeURIComponent(group.name)}` : '';
  return `${origin}${pathname}?joinCode=${code}${typeParam}${nameParam}`;
}

/**
 * Standardized share payload for inviting members.
 * Conforms to Apple HIG and Google Material 3 native sharing expectations.
 */
export function getGroupInviteShareData(group: ExpenseGroup | { id: string; name: string; inviteCode?: string; type?: string }) {
  const url = getGroupInviteUrl(group);
  const isSplit = group.type === 'split';
  return {
    title: isSplit ? `${group.name} · Split Ledger` : `${group.name} · Expense Ledger`,
    text: isSplit
      ? `Join "${group.name}" on Hisaab Barabar to split shared expenses, track balances, and settle dues via UPI.`
      : `Join "${group.name}" on Hisaab Barabar to track shared expenses, category budgets, and recurring bills.`,
    url
  };
}

/**
 * Invokes the platform's native share sheet (Apple AirDrop, WhatsApp, iMessage, etc.),
 * falling back gracefully to clipboard copy with user feedback.
 */
export async function shareGroupInviteLink(
  group: ExpenseGroup | { id: string; name: string; inviteCode?: string; type?: string },
  showToast?: (message: string) => void
): Promise<{ shared: boolean; copied: boolean }> {
  if (!group) return { shared: false, copied: false };

  const shareData = getGroupInviteShareData(group);
  const url = shareData.url;

  // 1. Native Share Sheet (iOS, Android, macOS Safari, PWA)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(shareData);
      if (showToast) showToast('Invite link shared!');
      return { shared: true, copied: false };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User closed or dismissed the native share sheet
        return { shared: false, copied: false };
      }
    }
  }

  // 2. Fallback: Copy URL to clipboard
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      if (showToast) showToast('Invite link copied to clipboard!');
      return { shared: false, copied: true };
    }
  } catch {
    if (showToast) showToast('Invite link: ' + url);
  }

  return { shared: false, copied: false };
}

/**
 * Copies the invite code to clipboard with standardized toast feedback.
 */
export async function copyGroupInviteCode(
  group: ExpenseGroup | { inviteCode?: string },
  showToast?: (message: string) => void
): Promise<boolean> {
  const code = group.inviteCode;
  if (!code) return false;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(code);
      if (showToast) showToast('Invite code copied to clipboard!');
      return true;
    }
  } catch {
    if (showToast) showToast('Invite code: ' + code);
  }
  return false;
}
