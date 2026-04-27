import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import { Invoice, BusinessSettings } from '@/types';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { InvoiceView } from '@/components/invoices/InvoiceView';

// We need a way to render the invoice WITHOUT the modal/preview UI
// Let's create a specialized minimal renderer for the export

export async function exportInvoices(
  invoices: Invoice[], 
  settings: BusinessSettings, 
  type: 'pdf' | 'zip',
  onProgress?: (current: number, total: number) => void
) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm'; // A4 width
  document.body.appendChild(container);

  const root = createRoot(container);
  
  const zip = type === 'zip' ? new JSZip() : null;
  const mergedPdf = type === 'pdf' ? new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) : null;

  try {
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      if (onProgress) onProgress(i + 1, invoices.length);
      
      // Render the invoice to the container
      // Note: We need to pass a dummy onClose and handle the "style" preference
      // We'll use a specialized component or just the print area part of InvoiceView
      // For now, let's try to reuse the logic.
      
      await new Promise<void>((resolve) => {
        root.render(
          <div id="export-root" className="bg-white">
            <style dangerouslySetInnerHTML={{ __html: `
              #invoice-print-area {
                --color-slate-50: #f8fafc;
                --color-slate-100: #f1f5f9;
                --color-slate-200: #e2e8f0;
                --color-slate-300: #cbd5e1;
                --color-slate-400: #94a3b8;
                --color-slate-500: #64748b;
                --color-slate-600: #475569;
                --color-slate-700: #334155;
                --color-slate-800: #1e293b;
                --color-slate-900: #0f172a;
                --color-slate-950: #020617;
              }
            ` }} />
            <InvoiceExportRenderer invoice={invoice} settings={settings} />
          </div>
        );
        // Give it some time to render and styles to apply
        setTimeout(resolve, 800);
      });

      const element = document.getElementById('invoice-print-area');
      if (!element) continue;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.classList.remove('dark');
          clonedDoc.body.classList.remove('dark');
          clonedDoc.querySelectorAll('.dark').forEach(el => el.classList.remove('dark'));
          clonedDoc.querySelectorAll('*').forEach(el => (el as HTMLElement).style.colorScheme = 'light');

          // Neutralize modern CSS functions and font properties that crash html2canvas
          const styleSheets = clonedDoc.querySelectorAll('style');
          styleSheets.forEach(sheet => {
            if (sheet.innerHTML.includes('okl') || sheet.innerHTML.includes('font-') || sheet.innerHTML.includes('var(')) {
              // Replace oklch/oklab with hex - handling nested parentheses (common in Tailwind 4)
              sheet.innerHTML = sheet.innerHTML.replace(/okl[a-z]{2,3}\s*\([^()]*(\([^()]*\)[^()]*)*\)/gi, '#334155');
              // Remove modern font properties that can cause issues
              sheet.innerHTML = sheet.innerHTML.replace(/font-variant-[a-z-]+\s*:[^;]+;/gi, '');
              sheet.innerHTML = sheet.innerHTML.replace(/font-feature-settings\s*:[^;]+;/gi, '');
              sheet.innerHTML = sheet.innerHTML.replace(/font-variation-settings\s*:[^;]+;/gi, '');
            }
          });

          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            try {
              const style = el.style;
              if (style) {
                // Reset any styles that might use modern color functions
                if (style.color?.match(/okl/i)) style.color = '#334155';
                if (style.backgroundColor?.match(/okl/i)) style.backgroundColor = 'transparent';
                if (style.borderColor?.match(/okl/i)) style.borderColor = '#334155';
                
                // Defensively clear font-variant which often causes PDF crashes
                style.fontVariantNumeric = 'normal';
                style.fontFeatureSettings = 'normal';
                style.fontVariantCaps = 'normal';
                style.fontVariantLigatures = 'none';
                style.fontVariantAlternates = 'normal';
              }
            } catch (e) {}
          }
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root {
              color-scheme: light !important;
              --background: #ffffff !important;
              --foreground: #1e293b !important;
            }
            * { 
              color-scheme: light !important; 
              font-variant-numeric: normal !important;
              font-feature-settings: normal !important;
              font-variant-caps: normal !important;
              font-variant-ligatures: none !important;
              font-variant-alternates: normal !important;
              font-variation-settings: normal !important;
            }
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

      if (!canvas || canvas.width === 0) {
        continue;
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      if (type === 'zip' && zip) {
        const base64Data = imgData.split(',')[1];
        // We'll actually generate a per-invoice PDF for the ZIP
        const tempPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = tempPdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        tempPdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        const pdfBlob = tempPdf.output('blob');
        zip.file(`${invoice.invoiceNumber}.pdf`, pdfBlob);
      } else if (type === 'pdf' && mergedPdf) {
        if (i > 0) mergedPdf.addPage();
        const pdfWidth = mergedPdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        mergedPdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
    }

    if (type === 'zip' && zip) {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoices_Export_${new Date().getTime()}.zip`;
      link.click();
    } else if (type === 'pdf' && mergedPdf) {
      mergedPdf.save(`Invoices_Merged_${new Date().getTime()}.pdf`);
    }

  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

// Minimal renderer for export
import { format } from 'date-fns';
import { amountToWords, formatCurrency, generateUPIUrl } from '@/lib/invoice-utils';
import { QRCodeCanvas } from 'qrcode.react';
import { cn } from '@/lib/utils';

function InvoiceExportRenderer({ invoice, settings }: { invoice: Invoice, settings: BusinessSettings }) {
  const currentStyle = invoice.pdfStyle || 'Professional';
  
  const styles: Record<string, any> = {
    Standard: {
      header: "bg-slate-100 p-12 border-b-2 border-slate-200",
      accent: "text-slate-900",
      border: "border-slate-200",
      font: "font-sans",
      tableHeader: "bg-slate-50 border-y border-slate-200 text-slate-600",
      heading: "font-bold"
    },
    Professional: {
      header: "bg-[#237227] text-white p-12",
      accent: "text-[#237227]",
      border: "border-[#237227]/20",
      font: "font-sans",
      tableHeader: "border-b-2 border-[#237227] text-[#237227]",
      heading: "font-black tracking-tight"
    },
    Modern: {
      header: "bg-white text-[#0f172a] p-0 rounded-t-2xl",
      accent: "text-[#008080]",
      border: "border-slate-300",
      font: "font-sans",
      tableHeader: "bg-slate-50 border-y border-slate-300 text-slate-700",
      heading: "font-black tracking-tight"
    },
    Classic: {
      header: "bg-white text-black p-12 border-b-8 border-double border-black",
      accent: "text-black",
      border: "border-black/10",
      font: "font-serif",
      tableHeader: "border-y-2 border-black text-black",
      heading: "font-bold italic"
    },
    Simple: {
      header: "bg-white p-4 border-2 border-black",
      accent: "text-black",
      border: "border-black",
      font: "font-sans",
      tableHeader: "bg-white border-y-2 border-black text-black font-bold uppercase text-[10px]",
      heading: "font-black"
    },
    Creative: {
      header: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-16",
      accent: "text-blue-600",
      border: "border-blue-100",
      font: "font-sans",
      tableHeader: "text-blue-600 border-b border-blue-100 uppercase text-[10px] tracking-widest",
      heading: "tracking-widest uppercase font-black"
    },
    Detailed: {
      header: "bg-slate-50 p-8 border border-slate-200",
      accent: "text-red-700",
      border: "border-slate-200",
      font: "font-sans",
      tableHeader: "bg-slate-100 border border-slate-300 text-slate-700 h-8",
      heading: "font-black tracking-tighter uppercase"
    },
    Thermal: {
      header: "",
      accent: "text-black",
      border: "border-black",
      font: "font-mono",
      tableHeader: "",
      heading: ""
    }
  };

  const style = styles[currentStyle] || styles.Professional;
  const upiUrl = invoice.currency === 'INR' && settings.upiId 
    ? generateUPIUrl(settings.upiId, settings.companyName, invoice.totalAmount, invoice.invoiceNumber)
    : null;

  return (
    <div 
      id="invoice-print-area"
      className={cn(
        "bg-white w-[210mm] min-h-[297mm] flex flex-col",
        style.font,
        currentStyle === 'Modern' ? 'rounded-2xl' : ''
      )}
    >
      {/* Copy of the rendering logic from InvoiceView */}
      {currentStyle === 'Simple' ? (
        <div className="flex flex-col text-[10px] text-black bg-white border-2 border-black m-2">
          {/* Image-style Header */}
          <div className="p-4 border-b-2 border-black">
            <div className="flex justify-between items-start text-[9px] font-bold">
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
            <div className="flex-1 p-1 px-2">Invoice No:{invoice.invoiceNumber}</div>
            <div className="flex-1 p-1 px-2 text-right">DATE: {format(new Date(invoice.date), 'dd-MM-yyyy')}</div>
          </div>

          {/* Info Grid - Bill To & State info */}
          <div className="grid grid-cols-2 divide-x-2 divide-black border-b-2 border-black">
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
                <tr className="divide-x-2 divide-black h-6 text-center">
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
          <div className="border-b-2 border-black p-1 px-8 flex gap-4 items-center">
            <span className="font-bold italic uppercase text-[9px]">Amount In Words:</span>
            <span className="font-black uppercase text-[10px]">Rupees {amountToWords(invoice.totalAmount, invoice.currency)} Only</span>
          </div>

          {/* Boxed Footer with Bank Details */}
          <div className="p-1 px-4 flex justify-between items-center text-[9px] font-bold uppercase divide-x-2 divide-black -mx-px">
            <div className="flex-1 flex gap-4">
              <span>Ac No:{settings.accountNumber}</span>
              <span>Ifsc:{settings.ifscCode}</span>
              <span>{settings.bankName}</span>
            </div>
            <div className="px-8 font-black">For {settings.companyName.toUpperCase()}</div>
          </div>
        </div>
      ) : (
        <>
          <div className={style.header}>
        <div className="flex justify-between items-start">
          <div className="space-y-6">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
            ) : (
              <div className={cn("text-4xl uppercase leading-none", style.heading)}>{settings.companyName}</div>
            )}
            <div className="text-xs opacity-80 max-w-sm leading-relaxed font-medium">
              {settings.address}
              <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1 opacity-70">
                <span>GSTIN: {settings.gstin}</span>
                <span>State Code: {settings.stateCode}</span>
              </div>
            </div>
          </div>
          <div className="text-right space-y-2">
            <div className={cn("text-5xl uppercase tracking-tight leading-none", style.heading)}>{invoice.type}</div>
            <div className="text-lg font-mono opacity-80 font-bold">{invoice.invoiceNumber}</div>
            <div className="pt-8 space-y-1">
              <div className="text-[10px] uppercase tracking-widest font-bold opacity-60">Bill Date</div>
              <div className="text-sm font-bold">{format(new Date(invoice.date), 'dd MMMM yyyy')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-12 md:p-16 flex-1 flex flex-col gap-12">
        <div className="grid grid-cols-2 gap-16">
          <div className="space-y-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Bill To Customer</div>
            <div className="text-xl font-bold text-[#0f172a]">{invoice.clientName}</div>
            <div className="text-sm text-[#475569] leading-relaxed max-w-xs">
              {invoice.clientAddress}
              <div className="pt-2 font-mono text-[10px] uppercase font-bold text-[#94a3b8]">
                GSTIN: {invoice.clientGstin} | State: {invoice.clientStateCode}
              </div>
            </div>
          </div>
          {invoice.paymentMethod && (
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Payment Channel</div>
              <div className={cn("text-sm font-bold pt-2", style.accent)}>{invoice.paymentMethod}</div>
            </div>
          )}
        </div>

        <div className="flex-1">
          <table className="w-full">
            <thead>
              <tr className={cn("text-[10px] font-black uppercase tracking-widest", style.tableHeader)}>
                <th className="py-5 text-left pr-4">Line Items / Services</th>
                <th className="py-5 text-center px-4">HSN/SAC</th>
                <th className="py-5 text-center px-4">Qty</th>
                <th className="py-5 text-right px-4">Unit Rate</th>
                <th className="py-5 text-right pl-4">Total</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", style.border)}>
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-6 pr-4">
                    <div className="font-bold text-sm text-[#0f172a]">{item.name}</div>
                  </td>
                  <td className="py-6 text-center px-4 text-[10px] font-mono text-[#94a3b8] font-bold">{item.hsn}</td>
                  <td className="py-6 text-center px-4 text-sm font-bold font-mono">{item.quantity}</td>
                  <td className="py-6 text-right px-4 text-sm font-bold font-mono">{formatCurrency(item.price, invoice.currency)}</td>
                  <td className="py-6 text-right pl-4 font-black text-sm font-mono text-[#0f172a]">{formatCurrency(item.total, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-16 mt-auto">
          <div className="space-y-10">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Total in Words</div>
              <div className={cn("text-xs italic font-bold leading-relaxed p-4 rounded-lg border", style.border, currentStyle === 'Modern' ? "bg-[#f8fafc]" : "bg-white")}>
                {amountToWords(invoice.totalAmount, invoice.currency)}
              </div>
            </div>
            
            {upiUrl && (
              <div className={cn("flex gap-6 items-center p-5 rounded-2xl border w-fit", style.border, currentStyle === 'Modern' ? "bg-[#f8fafc]" : "bg-white")}>
                <QRCodeCanvas value={upiUrl} size={80} level="H" />
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#0f172a]">Instant UPI Payment</div>
                  <div className="text-[10px] text-[#64748b] font-mono font-bold">{settings.upiId}</div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className={cn("p-8 rounded-2xl space-y-4 border", style.border, currentStyle === 'Modern' ? "bg-slate-950 text-white" : "bg-slate-50")}>
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-60 font-black uppercase tracking-widest">Gross Subtotal</span>
                <span className="font-mono font-bold">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
              </div>
              <div className={cn("pt-6 border-t flex justify-between items-center", currentStyle === 'Modern' ? "border-white/10" : "border-[#e2e8f0]")}>
                <span className="text-sm font-black uppercase tracking-widest">Final Total</span>
                <span className={cn("text-3xl font-black font-mono", style.accent)}>{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
              </div>
            </div>
            <div className="pt-12 flex flex-col items-end gap-3 text-right">
              {settings.signatureUrl && (
                <img src={settings.signatureUrl} alt="Signature" className="h-16 w-auto mb-2 mix-blend-multiply brightness-75" />
              )}
              <div className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Authorized Signatory</div>
              <div className="text-sm font-black text-[#0f172a]">{settings.companyName}</div>
            </div>
          </div>
        </div>
      </div>
    </>
    )}
  </div>
);
}
