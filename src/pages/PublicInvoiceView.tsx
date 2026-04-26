import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Invoice, BusinessSettings } from '@/types';
import { QRCodeCanvas } from 'qrcode.react';
import { format } from 'date-fns';
import { amountToWords, generateUPIUrl, formatCurrency } from '@/lib/invoice-utils';
import { Button } from '@/components/ui/button';
import { Download, Printer, CreditCard, Loader2, Truck } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

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
    try {
      setIsExporting(true);
      const element = document.getElementById('invoice-print-area');
      if (!element) return;

      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.classList.remove('dark');
          clonedDoc.body.classList.remove('dark');

          const styleSheets = clonedDoc.querySelectorAll('style');
          styleSheets.forEach(sheet => {
            if (sheet.innerHTML.includes('okl')) {
              sheet.innerHTML = sheet.innerHTML.replace(/oklch\([^)]+\)/g, 'inherit');
              sheet.innerHTML = sheet.innerHTML.replace(/oklab\([^)]+\)/g, 'inherit');
            }
          });

          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            try {
              if (el.style.color?.includes('okl')) el.style.color = 'inherit';
              if (el.style.backgroundColor?.includes('okl')) el.style.backgroundColor = 'transparent';
              if (el.style.borderColor?.includes('okl')) el.style.borderColor = 'inherit';
            } catch (e) {}
          }
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root {
              color-scheme: light !important;
              --background: 255 255 255 !important;
              --foreground: 30 41 59 !important;
            }
            * { color-scheme: light !important; }
            #invoice-print-area { background-color: white !important; color: #1e293b !important; }
            .bg-background { background-color: #ffffff !important; }
            .text-foreground { color: #1e293b !important; }
            .bg-primary { background-color: #237227 !important; }
            .text-primary { color: #237227 !important; }
            .bg-slate-50 { background-color: #f8fafc !important; }
            .bg-slate-100 { background-color: #f1f5f9 !important; }
            .text-slate-900 { color: #0f172a !important; }
            .text-slate-600 { color: #475569 !important; }
            .text-slate-500 { color: #64748b !important; }
          `;
          clonedDoc.head.appendChild(style);
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice-${invoice.invoiceNumber}.pdf`);
      toast.success('Downloaded');
    } catch (err) {
      toast.error('Failed to generate PDF');
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
              <div className="flex flex-col h-full text-[11px] text-slate-900 font-sans">
                {/* Modern / Industrial Header */}
                <div className="p-6 md:p-8 flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-4 text-left">
                    <div className="text-4xl md:text-5xl font-black tracking-tighter text-[#008080] leading-none uppercase">
                      {settings.companyName}
                    </div>
                    <div className="bg-[#008080] text-white px-4 py-1 text-[10px] md:text-xs font-bold tracking-wide w-fit">
                      Manufacturing & Supply of Precision Press Tool & Room Component
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[10px] md:text-xs font-medium text-slate-600">
                      <div className="max-w-[240px] leading-relaxed italic">{settings.address}</div>
                      <div className="text-right space-y-0.5">
                        <div className="font-bold text-slate-900">Tel : {settings.phone}</div>
                        <div>Web : www.logobuild.com</div>
                        <div>Web : {settings.email}</div>
                      </div>
                    </div>
                  </div>
                  {settings.logoUrl && (
                    <img src={settings.logoUrl} alt="Logo" className="h-20 w-auto object-contain" />
                  )}
                </div>

                {/* PAN Bar */}
                <div className="border-y border-slate-300 bg-slate-50 flex items-center justify-between px-4 py-1 font-bold text-[10px] md:text-xs uppercase tracking-wider">
                  <div>PAN : <span className="font-mono">{settings.pan || '-'}</span></div>
                  <div className="text-sm md:text-lg tracking-tighter">{invoice.type}</div>
                  <div>Original for Recipient</div>
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
                         <tr key={`empty-${i}`} className="divide-x divide-slate-300 h-8">
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
            ) : (
              <div className="p-6 md:p-16 space-y-8 md:space-y-12">
                <div className="flex flex-col md:flex-row justify-between gap-8 border-b-2 border-slate-900 pb-8 md:pb-12 text-left">
                  <div className="space-y-6">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="h-12 md:h-16 w-auto object-contain" />
                    ) : (
                      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tighter uppercase leading-none">{settings.companyName}</h2>
                    )}
                    <div className="space-y-1">
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed max-w-md whitespace-pre-wrap font-medium">{settings.address}</p>
                      <div className="mt-4 space-y-1 text-[10px] md:text-xs">
                        <p><span className="font-bold opacity-50 uppercase tracking-widest">GSTIN:</span> {settings.gstin}</p>
                        <p><span className="font-bold opacity-50 uppercase tracking-widest">Email:</span> {settings.email}</p>
                        <p><span className="font-bold opacity-50 uppercase tracking-widest">Phone:</span> {settings.phone}</p>
                      </div>
                    </div>
                  </div>
                <div className="text-left md:text-right flex flex-col justify-between items-start md:items-end">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice Date</div>
                    <div className="text-lg md:text-xl font-bold">{invoice.date}</div>
                  </div>
                  <div className="mt-8">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</div>
                    <div className="text-3xl md:text-4xl font-black text-slate-900 leading-none">₹{invoice.totalAmount.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                <div className="text-left">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Client Information</h3>
                  <div className="space-y-1">
                    <p className="text-lg md:text-xl font-bold text-slate-900">{invoice.clientName}</p>
                    <p className="text-xs md:text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{invoice.clientAddress}</p>
                    {invoice.clientGstin && (
                      <p className="text-[10px] md:text-xs font-bold mt-4 uppercase tracking-widest text-slate-400">
                        GSTIN: <span className="text-slate-900">{invoice.clientGstin}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center md:items-end justify-center gap-4">
                   <div className="text-center md:text-right">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Scan & Pay via UPI</h3>
                      <div className="text-[10px] font-mono text-slate-500">{settings.upiId}</div>
                   </div>
                   {upiUrl && (
                     <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                       <QRCodeCanvas value={upiUrl} size={100} />
                     </div>
                   )}
                </div>
              </div>

              <div className="overflow-x-auto -mx-6 md:mx-0 px-6 md:px-0">
                <table className="w-full text-[13px] md:text-sm">
                  <thead>
                    <tr className="border-b border-slate-900 text-left">
                      <th className="py-4 md:py-6 font-black uppercase tracking-wider pr-4">Item Details</th>
                      <th className="py-4 md:py-6 font-black uppercase tracking-wider text-right px-4">Qty</th>
                      <th className="py-4 md:py-6 font-black uppercase tracking-wider text-right px-4">Price</th>
                      <th className="py-4 md:py-6 font-black uppercase tracking-wider text-right pl-4">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-left">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx} className="group">
                        <td className="py-4 md:py-6 pr-4">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-1">HSN: {item.hsn} • GST: {item.gstRate}%</div>
                        </td>
                        <td className="py-4 md:py-6 text-right tabular-nums px-4 font-medium">{item.quantity}</td>
                        <td className="py-4 md:py-6 text-right tabular-nums px-4 font-medium">₹{item.price.toLocaleString('en-IN')}</td>
                        <td className="py-4 md:py-6 text-right tabular-nums font-bold pl-4">₹{((item.price * item.quantity) + (item.price * item.quantity * item.gstRate / 100)).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col md:flex-row justify-between pt-8 gap-8 md:gap-12 text-left">
                  <div className="flex-1 space-y-6 md:space-y-8 order-2 md:order-1">
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Amount in Words</h3>
                      <div className="text-[13px] font-bold italic text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">{amountToWords(invoice.totalAmount, invoice.currency)}</div>
                    </div>
                    <div>
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Terms & Conditions</h3>
                      <div className="text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed font-medium">{settings.terms}</div>
                    </div>
                    {settings.signatureUrl && (
                      <div className="pt-4">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Authorized Signatory</div>
                        <img src={settings.signatureUrl} alt="Signature" className="h-12 w-auto mix-blend-multiply brightness-75" />
                      </div>
                    )}
                  </div>
                <div className="w-full md:w-80 space-y-4 md:space-y-6 order-1 md:order-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs py-1">
                      <span className="text-slate-400 font-bold uppercase tracking-widest">Taxable Amount</span>
                      <span className="font-bold text-slate-900">₹{invoice.taxableAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs py-1">
                      <span className="text-slate-400 font-bold uppercase tracking-widest">Total GST</span>
                      <span className="font-bold text-slate-900">₹{invoice.totalGst.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-6 bg-slate-900 text-white rounded-2xl px-6 shadow-xl shadow-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-widest">Grand Total</span>
                    <span className="text-2xl font-black">₹{invoice.totalAmount.toLocaleString('en-IN')}</span>
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
