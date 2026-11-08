import QRCode from 'qrcode';

/**
 * Normalizes and formats a UPI / VPA ID.
 * Standard format: username@bank (e.g. rahul@oksbi, payment@icici, user@paytm).
 */
export function formatUpiId(input: string): string {
  if (!input) return '';
  const clean = input.trim();

  if (clean.includes('@')) {
    const [userPart, handlePart] = clean.split('@');
    if (userPart && handlePart) {
      return `${userPart.trim().toLowerCase()}@${handlePart.trim().toLowerCase()}`;
    }
    return clean.toLowerCase();
  }

  return clean.toLowerCase();
}

/**
 * Validates whether the given string is a standard valid UPI / VPA ID.
 * Must contain username and bank handle separated by @.
 */
export function isValidUpiId(input: string): boolean {
  if (!input) return false;
  const clean = input.trim();
  // Standard VPA: minimum 2 chars before @, minimum 2 chars after @
  const upiPattern = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9.\-_]{2,32}$/;
  return upiPattern.test(clean);
}

/**
 * Constructs a standard NPCI compliant UPI payment URI.
 * @param pa Payee UPI / VPA address (e.g. pritesh@oksbi)
 * @param pn Payee Name as registered with the Bank / Account
 * @param am Optional settlement amount in INR
 * @param tn Optional transaction note
 */
export function buildUpiPaymentUri(params: {
  pa: string;
  pn?: string;
  am?: number;
  tn?: string;
}): string {
  const cleanVpa = formatUpiId(params.pa);
  if (!cleanVpa) return '';

  const cleanAmount = params.am && params.am > 0 ? params.am.toFixed(2) : '';
  const cleanPayee = params.pn?.trim();
  const cleanNote = params.tn?.trim();

  // In NPCI UPI spec:
  // pa is the only mandatory parameter.
  // pn is intentionally omitted when not explicitly set so the payer's UPI app
  // queries the NPCI directory and shows the recipient's verified bank account name.
  const queryParts = [
    `pa=${encodeURIComponent(cleanVpa)}`,
    cleanPayee ? `pn=${encodeURIComponent(cleanPayee)}` : null,
    cleanAmount ? `am=${encodeURIComponent(cleanAmount)}` : null,
    cleanAmount ? `cu=INR` : null,
    cleanNote ? `tn=${encodeURIComponent(cleanNote)}` : null
  ].filter(Boolean);

  return `upi://pay?${queryParts.join('&')}`;
}

export interface UpiAppLinks {
  generic: string;
  gpay: string;
  phonepe: string;
  paytm: string;
  bhim: string;
}

/**
 * Builds direct app-specific URL schemes for popular Indian UPI apps on iOS and Android.
 * Bypasses generic iOS scheme handler routing issues (e.g. WhatsApp claiming upi:// on iOS).
 */
export function buildUpiAppLinks(params: {
  pa: string;
  pn?: string;
  am?: number;
  tn?: string;
}): UpiAppLinks {
  const cleanVpa = formatUpiId(params.pa);
  if (!cleanVpa) {
    return { generic: '', gpay: '', phonepe: '', paytm: '', bhim: '' };
  }

  const cleanAmount = params.am && params.am > 0 ? params.am.toFixed(2) : '';
  const cleanPayee = params.pn?.trim();
  const cleanNote = params.tn?.trim();

  const queryParts = [
    `pa=${encodeURIComponent(cleanVpa)}`,
    cleanPayee ? `pn=${encodeURIComponent(cleanPayee)}` : null,
    cleanAmount ? `am=${encodeURIComponent(cleanAmount)}` : null,
    cleanAmount ? `cu=INR` : null,
    cleanNote ? `tn=${encodeURIComponent(cleanNote)}` : null
  ].filter(Boolean);

  const query = queryParts.join('&');

  return {
    generic: `upi://pay?${query}`,
    gpay: `gpay://upi/pay?${query}`,
    phonepe: `phonepe://pay?${query}`,
    paytm: `paytmmp://pay?${query}`,
    bhim: `bhim://upi/pay?${query}`
  };
}

/**
 * Generates a high-resolution, high-contrast QR Code Data URL for UPI scanning.
 * Uses high contrast black/white and error-correction level 'M' for rapid mobile camera acquisition.
 */
export async function generateUpiQrDataUrl(upiUri: string): Promise<string> {
  if (!upiUri) return '';
  return await QRCode.toDataURL(upiUri, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'M'
  });
}

// Local storage key for current user personal UPI cache
const PERSONAL_UPI_KEY = 'hisaab_user_personal_upi';

export function getSavedPersonalUpi(): string {
  try {
    return localStorage.getItem(PERSONAL_UPI_KEY) || '';
  } catch {
    return '';
  }
}

export function savePersonalUpi(upiId: string): void {
  try {
    const formatted = formatUpiId(upiId);
    if (formatted) {
      localStorage.setItem(PERSONAL_UPI_KEY, formatted);
    } else {
      localStorage.removeItem(PERSONAL_UPI_KEY);
    }
    localStorage.removeItem('hisaab_user_personal_payee_name');
  } catch {}
}

export function removePersonalUpi(): void {
  try {
    localStorage.removeItem(PERSONAL_UPI_KEY);
    localStorage.removeItem('hisaab_user_personal_payee_name');
  } catch {}
}

