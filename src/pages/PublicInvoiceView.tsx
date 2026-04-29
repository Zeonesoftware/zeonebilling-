import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Invoice, BusinessSettings } from '@/types';
import { QRCodeCanvas } from 'qrcode.react';
import { format } from 'date-fns';
import { amountToWords, generateUPIUrl, formatCurrency } from '@/lib/invoice-utils';
import { Button } from '@/components/ui/button';
import { Download, Printer, CreditCard, Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';

export default function PublicInvoiceView() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [invRes, setRes] = await Promise.all([
          fetch(`/api/data/invoices`),
          fetch(`/api/data/settings`)
        ]);
        const invoices = await invRes.json();
        const settingsArr = await setRes.json();
        
        const found = invoices.find((i: Invoice) => i.id === id);
        if (found) {
          setInvoice(found);
          setSettings(settingsArr[0]);
        }
      } catch (err) {
        toast.error('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) return <div className="p-20 text-center">Loading Invoice...</div>;
  if (!invoice || !settings) return <div className="p-20 text-center text-red-500">Invoice not found or link expired.</div>;

  const upiUrl = settings.upiId ? generateUPIUrl(settings.upiId, settings.companyName, invoice.totalAmount, invoice.invoiceNumber) : '';

  const handleDownloadPDF = async () => {
    const element = document.getElementById('invoice-print-area');
    if (!element) {
      toast.error('Preview not found');
      return;
    }

    try {
      setIsExporting(true);
      
      // Get all styles to include in Puppeteer
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');
      
      // Clone the element to manipulate it for printing without affecting the UI
      const clone = element.cloneNode(true) as HTMLElement;
      clone.classList.remove('dark');
      
      const baseUrl = window.location.origin;

      // Create a full HTML document for Puppeteer
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <base href="${baseUrl}">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${styles}
          <style>
             @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
             
             :root {
               --background: #ffffff !important;
               --foreground: #000000 !important;
               --primary: #0077C2 !important;
               --primary-foreground: #ffffff !important;
               --card: #ffffff !important;
               --card-foreground: #1e293b !important;
               --border: #e2e8f0 !important;
               --muted: #f1f5f9 !important;
               --muted-foreground: #64748b !important;
             }

             body { 
               background: white !important; 
               color: black !important;
               margin: 0; 
               padding: 20px; 
               -webkit-print-color-adjust: exact !important;
               print-color-adjust: exact !important;
               font-family: 'Inter', sans-serif !important;
             }
             
             #invoice-render-wrapper { 
               width: 210mm; 
               margin: 0 auto; 
               box-shadow: none !important;
               background: white !important;
             }

             .no-print { display: none !important; }
             
             @page {
               size: A4;
               margin: 0;
             }
          </style>
        </head>
        <body>
          <div id="invoice-render-wrapper">
             ${clone.outerHTML}
          </div>
        </body>
        </html>
      `;

      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: fullHtml,
          filename: `Invoice-${invoice.invoiceNumber}.pdf`
        })
      });

      if (!response.ok) {
        let errorMessage = 'PDF generation failed';
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } else {
          errorMessage = `Server Error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Professional PDF Downloaded');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-2 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 px-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Invoice Review</h1>
          <p className="text-xs text-slate-500 font-mono">Reference: #{invoice.invoiceNumber}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <Button variant="outline" size="sm" className="gap-2 flex-1 md:flex-none rounded-lg" onClick={() => window.print()}>
             <Printer className="w-4 h-4" /> Print
           </Button>
           <Button size="sm" className="bg-black text-white gap-2 flex-1 md:flex-none rounded-lg shadow-lg" onClick={handleDownloadPDF} disabled={isExporting}>
             {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
             Download PDF
           </Button>
        </div>
      </div>

      <div className="bg-white w-full max-w-4xl shadow-2xl md:rounded-2xl overflow-hidden mb-12">
         {/* Invoice Layout */}
         <div id="invoice-print-area" className="flex flex-col min-h-[297mm]">
            {invoice.pdfStyle === 'Modern' ? (
              <div className="flex flex-col h-full text-[11px] text-black border-[3px] border-black m-0 md:m-2 font-sans">
                {/* Modern / Industrial Header */}
                <div className="p-6 md:p-8 flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-4 text-left">
                    <div className="text-4xl md:text-5xl font-black tracking-tighter text-black leading-none uppercase">
                      {settings.companyName}
                    </div>
                    <div className="flex flex-col gap-1 text-[10px] md:text-sm font-bold text-black pt-2">
                       <div className="max-w-[400px] leading-relaxed italic uppercase font-medium">{settings.address}</div>
                       <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 border-t border-black/10 pt-2 text-[11px] md:text-xs">
                          <div className="flex items-center gap-1.5 font-black text-black">
                            <span className="opacity-40 text-[9px]">TEL:</span> {settings.phone}
                          </div>
                          <div className="flex items-center gap-1.5 font-black text-black">
                            <span className="opacity-40 text-[9px]">GSTIN:</span> {settings.gstin}
                          </div>
                       </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 min-w-[120px]">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
                    ) : (
                      <Logo className="h-16 w-16" />
                    )}
                    {(invoice.irn || invoice.ackNo) && (
                      <div className="flex items-start gap-4 border-[2px] border-black p-3 bg-white w-[260px] rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        {invoice.signedQrCode ? (
                          <div className="bg-white p-1">
                            <QRCodeCanvas value={invoice.signedQrCode} size={64} level="M" />
                          </div>
                        ) : (
                          <div className="w-[64px] h-[64px] bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-[8px] font-black uppercase text-slate-400 text-center px-1">QR</div>
                        )}
                        <div className="flex flex-col gap-1.5 flex-1 text-left">
                           <div className="text-black font-black text-xs md:text-sm leading-none uppercase border-b border-black/20 pb-1">E-INVOICE</div>
                           <div className="flex flex-col mt-1">
                              <span className="text-[7px] font-black uppercase text-slate-500">IRN / ACK NO</span>
                              <span className="text-[9px] font-mono font-bold leading-tight break-all uppercase text-black border-l-2 border-black pl-2 leading-none py-1">
                                {invoice.irn || invoice.ackNo}
                              </span>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* PAN Bar */}
                <div className="border-y-2 border-black bg-slate-50 flex items-center justify-between px-4 py-2 font-black text-[10px] md:text-xs uppercase tracking-wider text-black">
                  <div>PAN : <span className="font-mono">{settings.pan || '-'}</span></div>
                  <div className="flex flex-col items-center">
                    <div className="text-sm md:text-lg tracking-tighter font-black underline underline-offset-4">{invoice.type?.toUpperCase()}</div>
                  </div>
                  <div>ORIGINAL FOR RECIPIENT</div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 border-b border-slate-300 divide-x divide-slate-300">
                  <div className="p-4 space-y-2 text-left">
                    <div className="bg-slate-50 -mx-4 -mt-4 mb-2 py-1 px-4 border-b border-slate-300 text-center font-bold text-[10px] uppercase tracking-widest text-slate-600">Customer Detail</div>
                    <div className="grid grid-cols-[80px,1fr] gap-x-2 gap-y-1 mt-2">
                      <div className="font-bold opacity-60">M/S</div>
                      <div className="font-bold">{invoice.clientName}</div>
                      <div className="font-bold opacity-60">Address</div>
                      <div className="leading-snug text-[10px]">{invoice.clientAddress}</div>
                      <div className="font-bold opacity-60">Phone</div>
                      <div className="font-mono">{invoice.clientPhone || '-'}</div>
                      <div className="font-bold opacity-60">GSTIN</div>
                      <div className="font-mono font-bold">{invoice.clientGstin}</div>
                      <div className="font-bold opacity-60 text-[9px]">Place of Supply</div>
                      <div>State Code: {invoice.clientStateCode}</div>
                    </div>
                  </div>
                  <div className="p-4 space-y-2 text-left">
                    <div className="bg-slate-50 -mx-4 -mt-4 mb-2 py-1 px-4 border-b border-slate-300 text-center font-bold text-[10px] uppercase tracking-widest text-slate-600">Invoice Info</div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                       <div className="space-y-1">
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[9px]">
                            <span className="opacity-60">Invoice No.</span>
                            <span className="font-bold font-mono">{invoice.invoiceNumber}</span>
                          </div>
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[9px]">
                            <span className="opacity-60">Challan No</span>
                            <span className="font-bold font-mono text-[8px]">{invoice.challanNo || '-'}</span>
                          </div>
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[9px]">
                            <span className="opacity-60">E-Way No.</span>
                            <span className="font-bold font-mono text-[8px]">{invoice.ewayBillNo || '-'}</span>
                          </div>
                       </div>
                       <div className="space-y-1">
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[9px]">
                            <span className="opacity-60">Invoice Date</span>
                            <span className="font-bold">{format(new Date(invoice.date), 'dd-MMM-yyyy')}</span>
                          </div>
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[9px]">
                            <span className="opacity-60">Challan Date</span>
                            <span className="font-bold text-[8px]">{invoice.challanDate ? format(new Date(invoice.challanDate), 'dd-MMM-yyyy') : '-'}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="flex-1 border-b border-slate-300">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold uppercase tracking-widest text-slate-600 divide-x divide-slate-300 border-b border-slate-300">
                        <th className="py-2 px-2 text-center w-10">Sr.</th>
                        <th className="py-2 px-4 text-left">Description</th>
                        <th className="py-2 px-2 text-center">HSN</th>
                        <th className="py-2 px-2 text-center">Qty</th>
                        <th className="py-2 px-2 text-right">Rate</th>
                        <th className="py-2 px-2 text-right">Taxable</th>
                        <th className="py-2 px-2 text-center" colSpan={2}>IGST</th>
                        <th className="py-2 px-2 text-right">Total</th>
                      </tr>
                      <tr className="bg-slate-50 text-[8px] font-bold uppercase text-slate-500 divide-x divide-slate-300 border-b border-slate-300 text-center">
                        <th colSpan={6}></th>
                        <th className="w-8">%</th>
                        <th className="min-w-[50px] text-right px-1">Amount</th>
                        <th className=""></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className="divide-x divide-slate-300 align-top">
                          <td className="py-3 px-2 text-center">{idx + 1}</td>
                          <td className="py-3 px-4 text-left">
                            <div className="font-bold">{item.name}</div>
                          </td>
                          <td className="py-3 px-2 text-center font-mono">{item.hsn}</td>
                          <td className="py-3 px-2 text-center font-bold">{item.quantity} NOS</td>
                          <td className="py-3 px-2 text-right font-mono">{formatCurrency(item.price, invoice.currency)}</td>
                          <td className="py-3 px-2 text-right font-mono font-bold">{formatCurrency(item.quantity * item.price, invoice.currency)}</td>
                          <td className="py-3 px-2 text-center font-mono">{item.gstRate}%</td>
                          <td className="py-3 px-2 text-right font-mono">{formatCurrency(item.igst || 0, invoice.currency)}</td>
                          <td className="py-3 px-2 text-right font-bold font-mono">{formatCurrency(item.total, invoice.currency)}</td>
                        </tr>
                      ))}
                      {/* Empty rows to fill height */}
                      {Array.from({ length: 8 }).map((_, i) => (
                         <tr key={`empty-${i}`} className="divide-x-slate-300 h-8">
                            {Array.from({ length: 9 }).map((__, j) => <td key={j}></td>)}
                         </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-300 font-bold bg-slate-50">
                       <tr className="divide-x divide-slate-300">
                          <td colSpan={2} className="py-2 px-4 text-right uppercase tracking-widest text-[#008080]">Total</td>
                          <td></td>
                          <td className="text-center">{invoice.items.reduce((acc, item) => acc + item.quantity, 0)} NOS</td>
                          <td></td>
                          <td className="text-right font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
                          <td></td>
                          <td className="text-right font-mono">{formatCurrency(invoice.totalIgst || (invoice.totalCgst + invoice.totalSgst), invoice.currency)}</td>
                          <td className="text-right font-mono">{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
                       </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Footer Section */}
                <div className="grid grid-cols-12 divide-x divide-slate-300 border-b border-slate-300">
                   <div className="col-span-8 p-4 text-left">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Total in words</div>
                      <div className="text-[10px] font-black uppercase tracking-tight text-slate-700 italic leading-snug">
                        {amountToWords(invoice.totalAmount, invoice.currency)} ONLY
                      </div>
                      <div className="mt-8">
                         <div className="text-[9px] font-bold uppercase tracking-widest text-[#008080] mb-2">Bank Details</div>
                         <div className="grid grid-cols-[100px,1fr] gap-x-2 gap-y-0.5 text-[10px]">
                            <div className="opacity-60">Bank Name</div>
                            <div className="font-bold">{settings.bankName}</div>
                            <div className="opacity-60">Branch</div>
                            <div>{settings.bankBranch || '-'}</div>
                            <div className="opacity-60">A/C No.</div>
                            <div className="font-mono font-bold">{settings.accountNumber}</div>
                            <div className="opacity-60">IFSC Code</div>
                            <div className="font-mono font-bold">{settings.ifscCode}</div>
                         </div>
                      </div>
                   </div>
                   <div className="col-span-4 flex flex-col">
                      <div className="p-4 space-y-2 border-b border-slate-300 bg-slate-50">
                         <div className="flex justify-between text-[10px]">
                            <span className="opacity-60 font-bold uppercase">Subtotal</span>
                            <span className="font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                         </div>
                         <div className="flex justify-between text-[10px]">
                            <span className="opacity-60 font-bold uppercase">Tax Total</span>
                            <span className="font-mono">{formatCurrency(invoice.totalAmount - invoice.subtotal, invoice.currency)}</span>
                         </div>
                         <div className="flex justify-between text-xs font-black border-t border-slate-300 pt-2 text-[#008080]">
                            <span>TOTAL</span>
                            <span>{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
                         </div>
                      </div>
                      <div className="flex-1 p-4 flex flex-col justify-between items-center bg-white">
                         <div className="font-black text-[10px] uppercase tracking-wider mb-8">For {settings.companyName}</div>
                         {settings.signatureUrl ? (
                           <div className="flex flex-col items-center gap-2">
                             <img src={settings.signatureUrl} alt="Signature" className="h-12 w-auto mix-blend-multiply opacity-80" />
                             <div className="text-[9px] font-bold uppercase tracking-widest border-t border-slate-300 pt-1 w-full text-center">Authorised Signatory</div>
                           </div>
                         ) : (
                           <div className="text-[8px] text-slate-300 italic text-center border-t border-slate-100 pt-4 w-full">Digitally Verified Document</div>
                         )}
                      </div>
                   </div>
                </div>

                <div className="p-4 bg-slate-50/50 text-[9px] text-slate-500 italic text-left">
                   <div className="font-bold uppercase text-[8px] mb-1 opacity-60">Terms & Conditions:</div>
                   <div className="whitespace-pre-wrap leading-relaxed">{settings.terms}</div>
                </div>
              </div>
            ) : invoice.pdfStyle === 'Simple' ? (
              <div className="flex flex-col text-[10px] text-black bg-white border-2 border-black m-2">
                {/* Image-style Header */}
                <div className="p-4 border-b-2 border-black">
                  <div className="flex justify-between items-start text-[9px] font-bold text-left">
                    <div className="space-y-0.5">
                      <div>GSTIN:{settings.gstin}</div>
                      <div>FASSAI NO:{settings.fssai || 'N/A'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-black uppercase tracking-widest border-b border-black pb-0.5 mb-1 px-4">TAX INVOICE</div>
                    </div>
                    <div>MOBILE:{settings.phone}</div>
                  </div>
                  
                  <div className="text-center mt-2 space-y-1">
                    <h1 className="text-2xl font-black tracking-tighter uppercase">{settings.companyName}</h1>
                    <div className="text-[9px] font-bold uppercase">{settings.address}</div>
                  </div>
                </div>

                {/* Sub-Header bar - Invoice No & Date */}
                <div className="border-b-2 border-black flex divide-x-2 divide-black font-bold uppercase text-[10px]">
                  <div className="flex-1 p-1 px-2 text-left">Invoice No:{invoice.invoiceNumber}</div>
                  <div className="flex-1 p-1 px-2 text-right">DATE: {format(new Date(invoice.date), 'dd-MM-yyyy')}</div>
                </div>

                {/* Info Grid - Bill To & State info */}
                <div className="grid grid-cols-2 divide-x-2 divide-black border-b-2 border-black text-left">
                  <div className="p-2 space-y-1">
                    <div className="grid grid-cols-[80px,1fr] gap-x-2">
                      <span className="font-bold uppercase">BILL TO</span>
                      <span className="font-black">:{invoice.clientName}</span>
                      <span className="font-bold uppercase">ADDRESS</span>
                      <span className="font-bold uppercase leading-tight line-clamp-2">:{invoice.clientAddress}</span>
                      <span className="mt-1 font-bold uppercase">MOBILE</span>
                      <span className="mt-1 font-black">:{invoice.clientPhone || '-'}</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="grid grid-cols-[100px,1fr] gap-x-2">
                      <span className="font-bold uppercase">STATE & CODE</span>
                      <span className="font-black uppercase">{invoice.clientState} : {invoice.clientStateCode}</span>
                      <span className="font-bold uppercase">GST</span>
                      <span className="font-black uppercase">:{invoice.clientGstin || '-'}</span>
                      <span className="mt-1 font-bold uppercase">SMAN</span>
                      <span className="mt-1 font-black">:{invoice.salesmanName || 'karthi'}</span>
                    </div>
                  </div>
                </div>

                {/* Table with Detailed GST Breakdown */}
                <div className="border-b-2 border-black min-h-[300px]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-white text-[8px] font-black uppercase divide-x-2 divide-black border-b-2 border-black text-center">
                        <th className="w-8 py-1">SI.NO</th>
                        <th className="text-left px-2 py-1">PARTICULARS</th>
                        <th className="w-16 py-1">HSN CODE</th>
                        <th className="w-14 py-1">QTY</th>
                        <th className="w-16 py-1">RATE</th>
                        <th className="w-12 py-1">CGST</th>
                        <th className="w-16 py-1">CGST (amt)</th>
                        <th className="w-12 py-1">SGST</th>
                        <th className="w-16 py-1">SGST (amt)</th>
                        <th className="w-20 py-1">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className="divide-x-2 divide-black text-[9px] font-bold align-top h-8 uppercase">
                          <td className="text-center py-1">{idx + 1}</td>
                          <td className="px-2 py-1 text-left font-black">{item.name}</td>
                          <td className="text-center py-1">{item.hsn}</td>
                          <td className="text-center py-1">{item.quantity}{item.unit || 'PCS'}</td>
                          <td className="text-right px-1 py-1 font-mono">{item.price.toFixed(2)}</td>
                          <td className="text-center py-1">{item.gstRate / 2}%</td>
                          <td className="text-right px-1 py-1 font-mono">{(item.cgst || (item.igst / 2) || 0).toFixed(2)}</td>
                          <td className="text-center py-1">{item.gstRate / 2}%</td>
                          <td className="text-right px-1 py-1 font-mono">{(item.sgst || (item.igst / 2) || 0).toFixed(2)}</td>
                          <td className="text-right px-2 py-1 font-black">{(item.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {/* Fill empty space */}
                      {Array.from({ length: Math.max(0, 10 - invoice.items.length) }).map((_, i) => (
                        <tr key={`empty-${i}`} className="divide-x-2 divide-black h-8">
                          {Array.from({ length: 10 }).map((__, j) => <td key={j}></td>)}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-black font-black bg-white uppercase text-[9px]">
                      {/* Totals row breakdown matches the image row above footer */}
                      <tr className="divide-x-2 divide-black h-6 border-t-2 border-black text-center">
                        <td colSpan={4}></td>
                        <td className="px-1 text-right">{invoice.subtotal.toFixed(2)}</td>
                        <td colSpan={2} className="px-1 text-right">{(invoice.totalCgst || (invoice.totalIgst / 2) || 0).toFixed(2)}</td>
                        <td colSpan={2} className="px-1 text-right">{(invoice.totalSgst || (invoice.totalIgst / 2) || 0).toFixed(2)}</td>
                        <td className="px-2 text-right">{invoice.totalAmount.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Amount In Words Row */}
                <div className="border-b-2 border-black p-1 px-8 flex gap-4 items-center text-left">
                  <span className="font-bold italic uppercase text-[9px]">Amount In Words:</span>
                  <span className="font-black uppercase text-[10px]">Rupees {amountToWords(invoice.totalAmount, invoice.currency)} Only</span>
                </div>

                {/* Boxed Footer with Bank Details */}
                <div className="p-1 px-4 flex justify-between items-center text-[9px] font-bold uppercase divide-x-2 divide-black -mx-px">
                  <div className="flex-1 flex gap-4 text-left">
                    <span>Ac No:{settings.accountNumber}</span>
                    <span>Ifsc:{settings.ifscCode}</span>
                    <span>{settings.bankName}</span>
                  </div>
                  <div className="px-8 font-black text-right">For {settings.companyName.toUpperCase()}</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col text-[11px] text-black bg-white border-[3px] border-black m-0 md:m-2">
                <div className="p-8 pb-6 flex flex-col md:flex-row justify-between items-start border-b-[3px] border-black gap-4 text-left">
                  <div className="space-y-4">
                    <h1 className="text-3xl md:text-5xl font-black text-[#003366] tracking-tight uppercase leading-tight">
                      {settings.companyName}
                    </h1>
                    <div className="space-y-1 text-black font-bold text-[10px] md:text-[12px]">
                      <div className="max-w-md uppercase leading-relaxed">{settings.address}</div>
                      <div className="flex flex-col md:flex-row md:gap-8 font-black text-black pt-2 mt-2 border-t border-black/10">
                        <span className="flex items-center gap-1"><span className="opacity-50 text-[10px]">GSTIN</span> {settings.gstin}</span>
                        <span className="flex items-center gap-1"><span className="opacity-50 text-[10px]">MOBILE</span> {settings.phone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-start md:items-end gap-3 min-w-[200px] md:min-w-[300px] w-full md:w-auto">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="h-16 md:h-20 w-auto object-contain mb-2" />
                    ) : (
                      <Logo className="h-12 md:h-16 w-12 md:w-16 mb-2" />
                    )}
                    {(invoice.irn || invoice.ackNo) && (
                      <div className="flex items-start gap-4 border-[2px] border-black p-3 bg-white w-full rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        {invoice.signedQrCode ? (
                          <div className="bg-white p-1">
                            <QRCodeCanvas value={invoice.signedQrCode} size={64} level="M" />
                          </div>
                        ) : (
                          <div className="w-[64px] h-[64px] bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-[8px] font-black uppercase text-slate-400 text-center px-1">QR</div>
                        )}
                        <div className="flex flex-col gap-1.5 flex-1 text-left">
                           <div className="text-black font-black text-xs md:text-sm leading-none uppercase border-b border-black/20 pb-1">E-INVOICE</div>
                           <div className="flex flex-col mt-1">
                              <span className="text-[7px] font-black uppercase text-slate-500">IRN / ACK NO</span>
                              <span className="text-[9px] font-mono font-bold leading-tight break-all uppercase text-slate-900 border-l-2 border-black pl-2">{invoice.irn || invoice.ackNo || 'PENDING'}</span>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Header bar */}
                <div className="bg-slate-50 border-b-[3px] border-black flex divide-x-[3px] divide-black font-black uppercase tracking-widest text-[10px] md:text-[11px] h-10 md:h-12 items-center">
                  <div className="flex-1 px-4 whitespace-nowrap text-left">FSSAI : {settings.fssai || 'N/A'}</div>
                  <div className="flex-[2] px-4 text-center text-sm md:text-xl font-black tracking-[0.1em]">TAX INVOICE</div>
                  <div className="flex-1 px-4 text-right whitespace-nowrap">ORIGINAL COPY</div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y-[3px] md:divide-y-0 md:divide-x-[3px] divide-black border-b-[3px] border-black">
                  <div className="p-0 flex flex-col text-left">
                    <div className="bg-black text-white p-2 text-center font-black uppercase tracking-wider text-[11px]">Bill To (Recipient)</div>
                    <div className="p-4 grid grid-cols-[80px,1fr] gap-x-2 gap-y-3 flex-1 text-[11px] md:text-[12px]">
                      <span className="font-black opacity-40 uppercase tracking-tighter text-[9px] self-center">Customer</span>
                      <span className="font-black text-base uppercase leading-none border-b border-black/5 pb-1">{invoice.clientName}</span>
                      
                      <span className="font-black opacity-40 uppercase tracking-tighter text-[9px]">Address</span>
                      <span className="font-black uppercase leading-tight">{invoice.clientAddress}</span>
                      
                      <span className="font-black opacity-40 uppercase tracking-tighter text-[9px]">Mobile</span>
                      <span className="font-black">{invoice.clientPhone || '-'}</span>
                      
                      <span className="font-black opacity-40 uppercase tracking-tighter text-[9px]">GSTIN</span>
                      <span className="font-black uppercase bg-slate-50 px-2 py-0.5 rounded-sm w-fit">{invoice.clientGstin}</span>
                    </div>
                  </div>
                  <div className="p-0 border-r-0 text-left">
                    <div className="bg-black text-white p-2 text-center font-black uppercase tracking-wider text-[11px]">Invoice Details</div>
                    <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4 font-black h-full text-[11px]">
                       <div className="space-y-4">
                          <div className="flex flex-col gap-1 border-l-4 border-black pl-2">
                             <span className="opacity-40 text-[8px] font-black uppercase tracking-widest leading-none">Invoice No.</span>
                             <span className="font-black text-[14px] leading-tight text-blue-900">{invoice.invoiceNumber}</span>
                          </div>
                          <div className="flex flex-col gap-1 border-l-4 border-black/40 pl-2">
                             <span className="opacity-40 text-[8px] font-black uppercase tracking-widest leading-none">Challan No</span>
                             <span className="font-black leading-tight">{invoice.challanNo || '-'}</span>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <div className="flex flex-col gap-1 border-l-4 border-black pl-2">
                             <span className="opacity-40 text-[8px] font-black uppercase tracking-widest leading-none">Invoice Date</span>
                             <span className="font-black text-[14px] leading-tight">{format(new Date(invoice.date), 'dd/MM/yyyy')}</span>
                          </div>
                          <div className="flex flex-col gap-1 border-l-4 border-black/40 pl-2">
                             <span className="opacity-40 text-[8px] font-black uppercase tracking-widest leading-none">Transport</span>
                             <span className="font-black leading-tight">{invoice.transporterName || '-'}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="border-b-[3px] border-black overflow-x-auto flex-1">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-900 text-[10px] font-black uppercase tracking-widest text-white divide-x-2 divide-white/20 border-b-[3px] border-black text-center h-10">
                        <th className="w-10">Sr.</th>
                        <th className="text-left px-4">Description of Product / Service</th>
                        <th className="px-2 w-20">HSN</th>
                        <th className="px-2 w-16">Qty</th>
                        <th className="px-2 w-24 text-right">Rate</th>
                        <th className="p-0 border-b border-white/20 text-[8px]" colSpan={2}>CGST</th>
                        <th className="p-0 border-b border-white/20 text-[8px]" colSpan={2}>SGST</th>
                        <th className="px-4 w-28 text-right underline underline-offset-4 decoration-white/30">Total</th>
                      </tr>
                      <tr className="bg-slate-800 text-[8px] font-black uppercase text-white/60 divide-x-2 divide-white/10 border-b-[3px] border-black h-8">
                         <th colSpan={5}></th>
                         <th className="w-8">%</th>
                         <th className="w-16 px-2 text-right">Amt</th>
                         <th className="w-8">%</th>
                         <th className="w-16 px-2 text-right">Amt</th>
                         <th></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className="divide-x-[2px] divide-black text-[10px] md:text-[11px] font-black align-middle h-10 uppercase text-black">
                          <td className="text-center">{idx + 1}</td>
                          <td className="px-4 text-left font-black text-sm">{item.name}</td>
                          <td className="text-center font-mono opacity-50">{item.hsn}</td>
                          <td className="text-center">{item.quantity}</td>
                          <td className="text-right px-2 font-mono">₹{item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="text-center bg-slate-50">{item.gstRate / 2}%</td>
                          <td className="text-right px-2 font-mono bg-slate-50">₹{(item.cgst || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="text-center bg-slate-50">{item.gstRate / 2}%</td>
                          <td className="text-right px-2 font-mono bg-slate-50">₹{(item.sgst || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="text-right px-4 font-black text-base bg-slate-100">₹{item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-[3px] border-black font-black bg-slate-900 text-white uppercase text-[11px]">
                      <tr className="divide-x-2 divide-slate-700 h-10">
                        <td colSpan={2}></td>
                         <td className="text-center opacity-60">Total</td>
                        <td className="text-center text-xs">{invoice.items.reduce((acc, i) => acc + i.quantity, 0)} Nos</td>
                        <td></td>
                        <td colSpan={2} className="text-right px-2 font-mono">₹{(invoice.totalCgst || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td colSpan={2} className="text-right px-2 font-mono">₹{(invoice.totalSgst || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="text-right px-4 font-black italic bg-slate-800 text-sm">₹{invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Summary Section */}
                <div className="grid grid-cols-1 md:grid-cols-12 divide-y-[3px] md:divide-y-0 md:divide-x-[3px] divide-black border-b-[3px] border-black min-h-[120px] text-black text-left">
                   <div className="md:col-span-7 flex flex-col">
                      <div className="p-6 border-b-[3px] border-black min-h-[80px] bg-slate-50">
                        <div className="text-[10px] font-black uppercase tracking-widest mb-3 text-slate-400">Total in words</div>
                        <div className="text-[14px] font-black uppercase italic leading-tight tracking-tight text-blue-900 border-l-4 border-black pl-4">
                          {amountToWords(invoice.totalAmount, invoice.currency)} ONLY
                        </div>
                      </div>
                      <div className="flex-1 p-6 bg-white">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#003366] border-b-2 border-black/10 mb-4 pb-1">Payment Instructions</div>
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                           <div className="space-y-2 font-black flex-1 w-full text-[11px] uppercase">
                             <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1"><span className="opacity-50 text-[9px]">S/A Name</span> <span>{settings.companyName}</span></div>
                             <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1"><span className="opacity-50 text-[9px]">Account Number</span> <span className="font-mono text-sm bg-slate-50 px-2">{settings.accountNumber}</span></div>
                             <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1"><span className="opacity-50 text-[9px]">IFSC Code</span> <span className="font-mono text-sm">{settings.ifscCode}</span></div>
                             <div className="flex justify-between items-center"><span className="opacity-50 text-[9px]">Bank Details</span> <span className="">{settings.bankName}</span></div>
                           </div>
                           {upiUrl && (
                             <div className="flex flex-col items-center gap-2 border-[3px] border-black p-3 bg-white rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] self-center md:self-start">
                               <QRCodeCanvas value={upiUrl} size={100} level="H" />
                               <div className="text-[9px] font-black text-center leading-none mt-1 uppercase">Scan to Pay<br/>₹{invoice.totalAmount.toLocaleString()}</div>
                             </div>
                           )}
                        </div>
                      </div>
                   </div>
                    <div className="md:col-span-5 flex flex-col font-black divide-y-[3px] divide-black">
                      <div className="flex-1 p-6 space-y-4 text-[13px] uppercase font-black bg-white">
                        <div className="flex justify-between items-center">
                          <span className="opacity-40 text-[10px]">Net Taxable Amount</span>
                          <span className="font-mono text-lg">₹{invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-black font-black border-t-2 border-black/10 pt-3">
                          <span className="text-[10px]">Total Tax Amount (GST)</span>
                          <span className="font-mono text-lg">₹{(invoice.totalAmount - invoice.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <div className="h-16 flex items-center bg-slate-900 text-white divide-x-2 divide-slate-700">
                         <div className="px-6 text-[11px] font-black uppercase tracking-[0.2em] flex-1">Grand Total (Inclusive of all taxes)</div>
                         <div className="px-6 text-right font-black font-mono text-2xl min-w-[180px] text-blue-400">₹{invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <div className="flex-1 p-6 flex flex-col justify-between items-center bg-white min-h-[160px] text-center">
                         <div className="text-[10px] italic font-bold opacity-60 self-start border-l-4 border-[#003366] pl-3 mb-4 text-left leading-relaxed">Certified that the particulars given above are true and correct. Product(s) once sold cannot be returned.</div>
                         
                         <div className="w-full mt-4">
                            <div className="text-[11px] font-black mb-12 uppercase tracking-[0.2em]">For {settings.companyName.toUpperCase()}</div>
                            {settings.signatureUrl ? (
                              <div className="relative flex flex-col items-center">
                                <img src={settings.signatureUrl} alt="Signature" className="h-16 w-auto mix-blend-multiply brightness-50 absolute -top-14 z-10" />
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] border-t-[3px] border-black pt-3 w-full">Authorised Signatory</div>
                              </div>
                            ) : (
                              <div className="mt-4 border-t-[3px] border-black w-full pt-3 text-[11px] font-black uppercase tracking-[0.2em]">Authorised Signatory</div>
                            )}
                         </div>
                      </div>
                   </div>
                </div>

                <div className="p-6 flex flex-col md:flex-row justify-between items-center bg-slate-50 text-[11px] font-black text-black gap-6 border-t border-black/5">
                   <div className="flex flex-col gap-1 text-left w-full md:w-auto">
                     <h4 className="text-xl italic font-black text-blue-950 not-italic tracking-tighter">THANK YOU!</h4>
                     <div className="not-italic text-[8px] opacity-40 font-black uppercase tracking-[0.1em]">GST Compliant Digital Invoice • Generated on {format(new Date(), 'dd-MMM-yyyy HH:mm')}</div>
                   </div>
                   <div className="not-italic flex items-center gap-6 ml-auto">
                      <div className="flex flex-col items-end gap-1">
                        <div className="bg-black text-white px-4 py-1.5 rounded-sm text-[9px] tracking-[0.3em] font-black uppercase shadow-sm">Verified document</div>
                        <div className="opacity-50 uppercase tracking-tighter text-[7px] font-black">Maintained by Zeone Solutions & Software</div>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>

      <div className="p-8 text-center text-slate-400 text-[10px] uppercase tracking-widest">
        Generated by Zeone Billing Solutions
      </div>
    </div>
  );
}
