export function amountToWords(amount: number, currency: string = 'INR'): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    return '';
  }

  if (amount === 0) return 'Zero';

  let result = '';
  const val = Math.floor(amount);
  const fraction = Math.round((amount - val) * 100);

  if (currency === 'INR') {
    // Indian Numbering System (Lakh/Crore)
    const crore = Math.floor(val / 10000000);
    const left1 = val % 10000000;
    const lakh = Math.floor(left1 / 100000);
    const left2 = left1 % 100000;
    const thousand = Math.floor(left2 / 1000);
    const remaining = left2 % 1000;

    if (crore > 0) result += convert(crore) + ' Crore ';
    if (lakh > 0) result += convert(lakh) + ' Lakh ';
    if (thousand > 0) result += convert(thousand) + ' Thousand ';
    if (remaining > 0) result += convert(remaining);

    result = result.trim() + ' Rupees';
    if (fraction > 0) result += ' and ' + convert(fraction) + ' Paisa';
  } else {
    // International Numbering System (Million/Billion)
    const billion = Math.floor(val / 1000000000);
    const left1 = val % 1000000000;
    const million = Math.floor(left1 / 1000000);
    const left2 = left1 % 1000000;
    const thousand = Math.floor(left2 / 1000);
    const remaining = left2 % 1000;

    if (billion > 0) result += convert(billion) + ' Billion ';
    if (million > 0) result += convert(million) + ' Million ';
    if (thousand > 0) result += convert(thousand) + ' Thousand ';
    if (remaining > 0) result += convert(remaining);

    const currencyNames: Record<string, string> = {
      'USD': 'Dollars', 'EUR': 'Euros', 'GBP': 'Pounds', 'AUD': 'Dollars', 'CAD': 'Dollars', 'SGD': 'Dollars', 'AED': 'Dirhams'
    };
    const subCurrencyNames: Record<string, string> = {
      'USD': 'Cents', 'EUR': 'Cents', 'GBP': 'Pence', 'AUD': 'Cents', 'CAD': 'Cents', 'SGD': 'Cents', 'AED': 'Fils'
    };

    result = result.trim() + ' ' + (currencyNames[currency] || currency);
    if (fraction > 0) result += ' and ' + convert(fraction) + ' ' + (subCurrencyNames[currency] || 'Cents');
  }

  return result + ' Only';
}

export function formatCurrency(amount: number, currency: string = 'INR') {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function calculateGST(price: number, quantity: number, rate: number, isInterState: boolean, isTaxInclusive: boolean = false) {
  let taxableAmount;
  let gstAmount;

  if (isTaxInclusive) {
    const totalAmount = price * quantity;
    taxableAmount = totalAmount / (1 + rate / 100);
    gstAmount = totalAmount - taxableAmount;
  } else {
    taxableAmount = price * quantity;
    gstAmount = (taxableAmount * rate) / 100;
  }
  
  if (isInterState) {
    return { cgst: 0, sgst: 0, igst: gstAmount, total: taxableAmount + gstAmount };
  } else {
    return { cgst: gstAmount / 2, sgst: gstAmount / 2, igst: 0, total: taxableAmount + gstAmount };
  }
}

export function generateUPIUrl(upiId: string, name: string, amount: number, transactionRef: string) {
  const url = new URL(`upi://pay`);
  url.searchParams.append('pa', upiId);
  url.searchParams.append('pn', name);
  url.searchParams.append('am', amount.toFixed(2));
  url.searchParams.append('tr', transactionRef);
  url.searchParams.append('cu', 'INR');
  return url.toString();
}

export function generateNextInvoiceNumber(invoices: any[], settings: any, date: string = new Date().toISOString()) {
  const currentYear = new Date(date).getFullYear();
  const yearPrefix = currentYear.toString();
  
  // Filter invoices for current year
  const yearInvoices = invoices.filter(inv => {
    const invDate = new Date(inv.date);
    return !isNaN(invDate.getTime()) && invDate.getFullYear() === currentYear;
  });

  let nextSequence = 1;

  if (yearInvoices.length > 0) {
    const numbers = yearInvoices.map(inv => {
      const match = inv.invoiceNumber.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    nextSequence = Math.max(...numbers, 0) + 1;
  }

  const prefix = settings.invoicePrefix || 'INV';
  const sep = settings.invoiceSeparator || '-';
  const pad = settings.invoicePadding || 4;
  
  return `${prefix}${sep}${yearPrefix}${sep}${nextSequence.toString().padStart(pad, '0')}`;
}
