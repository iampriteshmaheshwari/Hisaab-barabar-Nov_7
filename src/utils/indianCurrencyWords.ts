/**
 * Converts numeric amount into Indian numbering format words (Rupees and Paise).
 * Follows standard Indian numbering conventions (Crores, Lakhs, Thousands, Hundreds).
 * E.g.:
 *  - 1 -> "One Rupee"
 *  - 500 -> "Five Hundred Rupees"
 *  - 1250 -> "One Thousand Two Hundred Fifty Rupees"
 *  - 150000 -> "One Lakh Fifty Thousand Rupees"
 *  - 10000000 -> "One Crore Rupees"
 *  - 100.50 -> "One Hundred Rupees and Fifty Paise"
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen'
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety'
];

function convertIndianInteger(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    return unit > 0 ? `${TENS[ten]} ${ONES[unit]}` : TENS[ten];
  }
  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const rem = n % 100;
    return rem > 0
      ? `${ONES[hundred]} Hundred ${convertIndianInteger(rem)}`
      : `${ONES[hundred]} Hundred`;
  }
  if (n < 100000) {
    // Thousands (up to 99 Thousand)
    const thousand = Math.floor(n / 1000);
    const rem = n % 1000;
    return rem > 0
      ? `${convertIndianInteger(thousand)} Thousand ${convertIndianInteger(rem)}`
      : `${convertIndianInteger(thousand)} Thousand`;
  }
  if (n < 10000000) {
    // Lakhs (up to 99 Lakh)
    const lakh = Math.floor(n / 100000);
    const rem = n % 100000;
    return rem > 0
      ? `${convertIndianInteger(lakh)} Lakh ${convertIndianInteger(rem)}`
      : `${convertIndianInteger(lakh)} Lakh`;
  }

  // Crores (10,000,000 and above)
  const crore = Math.floor(n / 10000000);
  const rem = n % 10000000;
  return rem > 0
    ? `${convertIndianInteger(crore)} Crore ${convertIndianInteger(rem)}`
    : `${convertIndianInteger(crore)} Crore`;
}

export function amountToIndianWords(amountInput: string | number): string {
  if (amountInput === '' || amountInput === null || amountInput === undefined) {
    return '';
  }

  const str = typeof amountInput === 'number' ? amountInput.toString() : amountInput.trim();
  if (!str) return '';

  const num = parseFloat(str);
  if (isNaN(num) || num <= 0 || !isFinite(num)) {
    return '';
  }

  // Separate integer and decimal fractions
  const parts = str.split('.');
  const intVal = parseInt(parts[0], 10) || 0;

  let paiseVal = 0;
  if (parts.length > 1 && parts[1]) {
    const decStr = parts[1];
    if (decStr.length === 1) {
      paiseVal = parseInt(decStr + '0', 10);
    } else {
      paiseVal = parseInt(decStr.slice(0, 2), 10);
    }
  }

  if (intVal === 0 && paiseVal === 0) {
    return '';
  }

  const rupeesText = intVal > 0 ? convertIndianInteger(intVal) : '';
  const paiseText = paiseVal > 0 ? convertIndianInteger(paiseVal) : '';

  if (rupeesText && paiseText) {
    const rupeeUnit = intVal === 1 ? 'Rupee' : 'Rupees';
    const paiseUnit = paiseVal === 1 ? 'Paisa' : 'Paise';
    return `${rupeesText} ${rupeeUnit} and ${paiseText} ${paiseUnit}`;
  } else if (rupeesText) {
    const rupeeUnit = intVal === 1 ? 'Rupee' : 'Rupees';
    return `${rupeesText} ${rupeeUnit}`;
  } else if (paiseText) {
    const paiseUnit = paiseVal === 1 ? 'Paisa' : 'Paise';
    return `${paiseText} ${paiseUnit}`;
  }

  return '';
}
