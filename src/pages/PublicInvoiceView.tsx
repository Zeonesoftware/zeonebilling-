import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Invoice, BusinessSettings } from '@/types';
import { QRCodeSVG } from 'qrcode.react';
import { amountToWords, generateUPIUrl } from '@/lib/invoice-utils';
import { Button } from '@/components/ui/button';
import { Download, Printer, CreditCard } from 'lucide-react';
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
    <div className="min-h-screen bg-[#f1f5f9] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Invoice Review</h1>
          <p className="text-sm text-slate-500 font-mono">#{invoice.invoiceNumber}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
             <Printer className="w-4 h-4" /> Print
           </Button>
           <Button size="sm" className="bg-black text-white gap-2" onClick={handleDownloadPDF} disabled={isExporting}>
             <Download className="w-4 h-4" /> Download PDF
           </Button>
        </div>
      </div>

      <div className="bg-white w-full max-w-4xl shadow-xl rounded-xl overflow-hidden mb-12">
         {/* Reusing existing Invoice Layout Logic... (Simplified for Portability) */}
         <div id="invoice-print-area" className="p-12 md:p-16 space-y-12">
              <div className="flex flex-col md:flex-row justify-between gap-8 border-b-2 border-slate-900 pb-12">
                <div className="space-y-6">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
                  ) : (
                    <h2 className="text-4xl font-extrabold tracking-tighter uppercase">{settings.companyName}</h2>
                  )}
                  <div className="space-y-1">
                    <p className="text-sm text-slate-600 leading-relaxed max-w-md whitespace-pre-wrap">{settings.address}</p>
                    <div className="mt-4 space-y-1 text-xs">
                      <p><span className="font-bold">GSTIN:</span> {settings.gstin}</p>
                      <p><span className="font-bold">Email:</span> {settings.email}</p>
                      <p><span className="font-bold">Phone:</span> {settings.phone}</p>
                    </div>
                  </div>
                </div>
              <div className="text-right flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice Date</div>
                  <div className="text-xl font-bold">{invoice.date}</div>
                </div>
                <div className="mt-8">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</div>
                  <div className="text-4xl font-black text-slate-900">₹{invoice.totalAmount.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Client Information</h3>
                <div className="space-y-1">
                  <p className="text-xl font-bold text-slate-900">{invoice.clientName}</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.clientAddress}</p>
                  {invoice.clientGstin && <p className="text-sm font-bold mt-2">GSTIN: {invoice.clientGstin}</p>}
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 flex flex-col items-center md:items-end justify-center">
                 <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Scan & Pay via UPI</h3>
                 {upiUrl && (
                   <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                     <QRCodeSVG value={upiUrl} size={120} />
                   </div>
                 )}
                 <div className="mt-2 text-[10px] font-mono text-slate-500">{settings.upiId}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-left">
                    <th className="py-4 font-black uppercase tracking-wider">Item Details</th>
                    <th className="py-4 font-black uppercase tracking-wider text-right">Qty</th>
                    <th className="py-4 font-black uppercase tracking-wider text-right">Price</th>
                    <th className="py-4 font-black uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="group">
                      <td className="py-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500">HSN: {item.hsn} • GST: {item.gstRate}%</div>
                      </td>
                      <td className="py-4 text-right tabular-nums">{item.quantity}</td>
                      <td className="py-4 text-right tabular-nums">₹{item.price.toLocaleString('en-IN')}</td>
                      <td className="py-4 text-right tabular-nums font-bold">₹{((item.price * item.quantity) + (item.price * item.quantity * item.gstRate / 100)).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col md:flex-row justify-between pt-8 gap-12">
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Amount in Words</h3>
                  <div className="text-sm font-medium italic text-slate-600 serif">Rupees {amountToWords(invoice.totalAmount)} only</div>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Terms & Conditions</h3>
                  <div className="text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed">{settings.terms}</div>
                </div>
              </div>
              <div className="w-full md:w-64 space-y-3">
                <div className="flex justify-between text-sm py-2 border-b border-dashed border-slate-200">
                  <span className="text-slate-500 uppercase tracking-tight">Taxable Amount</span>
                  <span className="font-bold">₹{invoice.taxableAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-dashed border-slate-200">
                  <span className="text-slate-500 uppercase tracking-tight">Total GST</span>
                  <span className="font-bold">₹{invoice.totalGst.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center py-4 bg-slate-900 text-white rounded-lg px-4 mt-4">
                  <span className="text-[10px] font-black uppercase tracking-widest">Grand Total</span>
                  <span className="text-xl font-black">₹{invoice.totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
         </div>
      </div>

      <div className="p-8 text-center text-slate-400 text-[10px] uppercase tracking-widest">
        Generated by Zeone Billing Solutions
      </div>
    </div>
  );
}
