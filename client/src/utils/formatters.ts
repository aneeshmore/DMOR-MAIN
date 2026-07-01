export const formatDisplayOrderId = (orderId: number, dateString?: string) => {
  if (!dateString) return `ORD-${orderId}`;
  const date = new Date(dateString);
  const year = date.getFullYear();
  const idStr = orderId.toString();
  const shortId = idStr.length > 3 ? idStr.slice(-3) : idStr.padStart(3, '0');
  return `ORD-${year}-${shortId}`;
};

const ones = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const thousands = ['', 'thousand', 'million', 'billion'];

function convertToWords(num: number): string {
  if (num === 0) return 'zero';

  let words = '';
  let i = 0;

  while (num > 0) {
    if (num % 1000 !== 0) {
      words = convertHundreds(num % 1000) + thousands[i] + ' ' + words;
    }
    num = Math.floor(num / 1000);
    i++;
  }

  return words.trim();
}

function convertHundreds(num: number): string {
  let str = '';

  if (num >= 100) {
    str += ones[Math.floor(num / 100)] + ' hundred ';
    num %= 100;
  }

  if (num >= 20) {
    str += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  }

  if (num > 0) {
    str += ones[num] + ' ';
  }

  return str;
}

export const numberToWords = (num: number): string => {
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let words = convertToWords(integerPart);

  if (decimalPart > 0) {
    words += ' and ' + convertToWords(decimalPart) + ' paise';
  }

  return words.charAt(0).toUpperCase() + words.slice(1);
};

const onesIndian = [
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
  'Nineteen',
];

const tensIndian = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertToIndianWords(num: number): string {
  if (num === 0) return '';

  const helper = (n: number): string => {
    let str = '';
    if (n >= 100000000000) { // Kharab (10^11)
      str += helper(Math.floor(n / 100000000000)) + ' Kharab ';
      n %= 100000000000;
    }
    if (n >= 1000000000) { // Arab (10^9)
      str += helper(Math.floor(n / 1000000000)) + ' Arab ';
      n %= 1000000000;
    }
    if (n >= 10000000) { // Crore (10^7)
      str += helper(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) { // Lakh (10^5)
      str += helper(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) { // Thousand (10^3)
      str += helper(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n >= 100) { // Hundred
      str += helper(Math.floor(n / 100)) + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tensIndian[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += onesIndian[n] + ' ';
    }
    return str.trim();
  };

  return helper(num).trim();
}

export const numberToIndianWords = (num: number): string => {
  const normalized = Math.round(num * 100) / 100;
  const integerPart = Math.floor(normalized);
  const decimalPart = Math.round((normalized - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) {
    return 'Zero Rupees Only';
  }

  let words = '';

  if (integerPart > 0) {
    words += convertToIndianWords(integerPart) + ' Rupees';
  }

  if (decimalPart > 0) {
    if (integerPart > 0) {
      words += ' and ';
    }
    words += convertToIndianWords(decimalPart) + ' Paise';
  }

  return words + ' Only';
};


// Date and Time formatting functions for IST (Indian Standard Time) and DD/MM/YY format
export const formatDateIST = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    // Convert to IST (Asia/Kolkata timezone)
    const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = istDate.getDate().toString().padStart(2, '0');
    const month = (istDate.getMonth() + 1).toString().padStart(2, '0');
    const year = istDate.getFullYear().toString().slice(-2); // Last 2 digits of year
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
};

export const formatDateTimeIST = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    // Convert to IST (Asia/Kolkata timezone)
    const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = istDate.getDate().toString().padStart(2, '0');
    const month = (istDate.getMonth() + 1).toString().padStart(2, '0');
    const year = istDate.getFullYear().toString().slice(-2); // Last 2 digits of year
    const hours = istDate.getHours().toString().padStart(2, '0');
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date time:', error);
    return '-';
  }
};

export const formatTimeIST = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    // Convert to IST (Asia/Kolkata timezone)
    const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hours = istDate.getHours().toString().padStart(2, '0');
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return '-';
  }
};

export const formatCurrency = (amount: number | string | undefined | null) => {
  if (amount === undefined || amount === null) return '-';
  const num = Number(amount);
  if (isNaN(num)) return '-';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

/**
 * Format decimal values for display.
 * - If `precision` is provided (number), the value will be shown with that many decimals using `toFixed`.
 * - If value is a string, it will be returned as-is (preserves exact stored value).
 * - If value is a number and no precision provided, it will be converted to string without forcing fixed decimals.
 */
export const formatDecimalDisplay = (
  value: number | string | null | undefined,
  options?: { precision?: number | null; placeholder?: string }
) => {
  const placeholder = options?.placeholder ?? '--';
  if (value === null || value === undefined || value === '') return placeholder;

  // Preserve exact string representation when available
  if (typeof value === 'string') return value;

  // If precision explicitly requested, format accordingly
  if (options && typeof options.precision === 'number') {
    const n = Number(value);
    if (isNaN(n)) return placeholder;
    return n.toFixed(options.precision);
  }

  // Default: return canonical string form of the number without forcing decimals
  return String(value);
};
