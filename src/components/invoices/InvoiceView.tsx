import React, { useRef, useState } from 'react';
import { 
  Download, 
  Printer, 
  X, 
  Share2, 
  Loader2,
  Mail,
  Link as LinkIcon,
  Globe,
  Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Invoice, BusinessSettings } from '@/types';
import { format } from 'date-fns';
import { formatCurrency, amountToWords, generateUPIUrl } from '@/lib/invoice-utils';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ThermalReceipt } from './ThermalReceipt';
import { EWayBillForm } from './EWayBillForm';

interface InvoiceViewProps {
  invoice: Invoice;
  settings: BusinessSettings;
  onClose: () => void;
  initialStyle?: Invoice['pdfStyle'] | 'Thermal';
}

export function InvoiceView({ invoice: initialInvoice, settings, onClose, initialStyle }: InvoiceViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const thermalRef = useRef<HTMLDivElement>(null);
  const [invoice, setInvoice] = useState(initialInvoice);
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [isEWayBillModalOpen, setIsEWayBillModalOpen] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<Invoice['pdfStyle'] | 'Thermal'>(initialStyle || invoice.pdfStyle || 'Professional');

  const handlePrint = () => {
    const content = (currentStyle === 'Thermal' ? thermalRef : printRef).current;
    if (!content) {
      toast.error('Print content not ready');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popups blocked. Please allow popups for printing.');
      return;
    }

    // Get all current styles to preserve look
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${invoice.invoiceNumber}</title>
          ${styles}
          <style>
            @media print {
              @page { 
                size: ${currentStyle === 'Thermal' ? '58mm auto' : 'A4'}; 
                margin: 0 !important; 
              }
              body { margin: 0 !important; padding: 0 !important; background: white !important; }
              #invoice-print-area, #thermal-receipt { 
                width: 100% !important; 
                box-shadow: none !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
              }
              /* Hide UI elements */
              .fixed, .sticky, header, button, .toaster { display: none !important; }
            }
            #invoice-print-area, #thermal-receipt {
              background: white !important;
              color: black !important;
            }
          </style>
        </head>
        <body class="bg-white">
          <div class="flex justify-center p-0 m-0">
            ${content.outerHTML}
          </div>
          <script>
            window.onload = () => {
              // Small delay to ensure everything is settled
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const upiUrl = invoice.currency === 'INR' && settings.upiId 
    ? generateUPIUrl(settings.upiId, settings.companyName, invoice.totalAmount, invoice.invoiceNumber)
    : null;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/view-invoice/${invoice.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Public view link copied to clipboard');
  };

  const generatePDFAsBase64 = async () => {
    const element = printRef.current;
    if (!element) throw new Error('Print area not found');

    await new Promise(resolve => setTimeout(resolve, 800));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      onclone: (clonedDoc) => {
        // Remove dark mode to avoid oklch colors from .dark variables
        clonedDoc.documentElement.classList.remove('dark');
        clonedDoc.body.classList.remove('dark');

        // Identify and and neutralize modern color functions in all style tags
        const styleSheets = clonedDoc.querySelectorAll('style');
        styleSheets.forEach(sheet => {
          if (sheet.innerHTML.includes('okl')) {
            // Replace oklch/oklab with hex or inherit to prevent parsing errors
            sheet.innerHTML = sheet.innerHTML.replace(/oklch\([^)]+\)/g, '#000000');
            sheet.innerHTML = sheet.innerHTML.replace(/oklab\([^)]+\)/g, '#000000');
          }
        });

        const elements = clonedDoc.getElementsByTagName('*');
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i] as HTMLElement;
          try {
            // Reset any inline styles that might use modern color functions
            if (el.style.color?.includes('okl')) el.style.color = '#000000';
            if (el.style.backgroundColor?.includes('okl')) el.style.backgroundColor = 'transparent';
            if (el.style.borderColor?.includes('okl')) el.style.borderColor = '#000000';
          } catch (e) {}
        }

        const style = clonedDoc.createElement('style');
        style.innerHTML = `
          :root { 
            color-scheme: light !important;
            --background: 255 255 255 !important;
            --foreground: 30 41 59 !important;
          }
          * {
            color-scheme: light !important;
          }
          #invoice-print-area { background-color: white !important; }
        `;
        clonedDoc.head.appendChild(style);
      }
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    return pdf.output('datauristring').split(',')[1];
  };

  const handleEmailInvoice = async () => {
    if (!invoice.clientEmail) {
      toast.error('Client email is missing');
      return;
    }

    const storedTokens = localStorage.getItem('google_tokens');
    if (!storedTokens) {
      toast.error('Please connect your Google account in Settings first');
      return;
    }

    const tokens = JSON.parse(storedTokens);
    setIsEmailing(true);
    const toastId = toast.loading('Generating invoice and sending email...');

    try {
      const pdfBase64 = await generatePDFAsBase64();
      
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: invoice.clientEmail,
          subject: `Invoice ${invoice.invoiceNumber} from ${settings.companyName}`,
          body: `Dear ${invoice.clientName},\n\nPlease find attached the invoice ${invoice.invoiceNumber} for your recent transaction.\n\nTotal Amount: ${formatCurrency(invoice.totalAmount, invoice.currency)}\n\nThank you for your business!\n\nBest regards,\n${settings.companyName}`,
          fileName: `Invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBase64,
          accessToken: tokens.access_token
        })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);
      
      toast.success(`Invoice sent to ${invoice.clientEmail}`, { id: toastId });
    } catch (err: any) {
      console.error('Email Error:', err);
      toast.error(err.message || 'Failed to send email', { id: toastId });
    } finally {
      setIsEmailing(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsExporting(true);
      const element = printRef.current;
      if (!element) {
        toast.error('Print area not found');
        return;
      }

      // Small delay to ensure all styles and fonts are applied
      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          // Remove dark mode to avoid oklch colors from .dark variables
          clonedDoc.documentElement.classList.remove('dark');
          clonedDoc.body.classList.remove('dark');

          // Identify and and neutralize modern color functions in all style tags
          const styleSheets = clonedDoc.querySelectorAll('style');
          styleSheets.forEach(sheet => {
            if (sheet.innerHTML.includes('okl')) {
              // Replace oklch/oklab with hex or inherit to prevent parsing errors
              sheet.innerHTML = sheet.innerHTML.replace(/oklch\([^)]+\)/g, '#000000');
              sheet.innerHTML = sheet.innerHTML.replace(/oklab\([^)]+\)/g, '#000000');
            }
          });

          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            try {
              // Reset any inline styles that might use modern color functions
              if (el.style.color?.includes('okl')) el.style.color = '#000000';
              if (el.style.backgroundColor?.includes('okl')) el.style.backgroundColor = 'transparent';
              if (el.style.borderColor?.includes('okl')) el.style.borderColor = '#000000';
            } catch (e) {}
          }
          
          // Inject a solid fallback style tag that uses only standard colors
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root {
              color-scheme: light !important;
              --background: 255 255 255 !important;
              --foreground: 30 41 59 !important;
            }
            * {
              color-scheme: light !important;
            }
            /* Force basic colors for common components */
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
      
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Generated canvas has zero dimensions');
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice-${invoice.invoiceNumber}.pdf`);
      toast.success('PDF Downloaded');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast.error('Failed to generate PDF. Please try printing (Ctrl+P) instead.');
    } finally {
      setIsExporting(false);
    }
  };

  const styles = {
    Professional: {
      header: "bg-[#237227] text-white p-12",
      accent: "text-[#237227]",
      border: "border-[#237227]/20",
      font: "font-sans",
      tableHeader: "border-b-2 border-[#237227] text-[#237227]",
      heading: "font-black tracking-tight"
    },
    Modern: {
      header: "bg-[#0f172a] text-white p-16 rounded-t-2xl",
      accent: "text-[#0f172a]",
      border: "border-[#f1f5f9]",
      font: "font-display",
      tableHeader: "bg-[#f8fafc] border-y border-[#f1f5f9] text-[#64748b]",
      heading: "font-medium tracking-tighter"
    },
    Classic: {
      header: "bg-white text-black p-12 border-b-8 border-double border-black",
      accent: "text-black",
      border: "border-black/10",
      font: "font-serif",
      tableHeader: "border-y-2 border-black text-black",
      heading: "font-bold italic"
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

  const style = styles[currentStyle || 'Professional'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-auto">
      <div className="bg-white w-full max-w-5xl h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className={cn("flex flex-col md:flex-row items-start md:items-center justify-between px-6 py-4 border-b bg-white sticky top-0 z-20 gap-4", style.font)}>
          <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <h3 className="font-bold flex-shrink-0">Preview</h3>
            <Select value={currentStyle || ""} onValueChange={(v: any) => setCurrentStyle(v)}>
              <SelectTrigger className="w-40 h-9 font-bold flex-shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Professional" className="font-sans">Professional</SelectItem>
                <SelectItem value="Modern" className="font-display">Modern</SelectItem>
                <SelectItem value="Classic" className="font-serif">Classic</SelectItem>
                <SelectItem value="Thermal" className="font-mono">Thermal Receipt (58mm)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2 rounded-full flex-shrink-0">
              <LinkIcon className="w-4 h-4" /> Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleEmailInvoice} disabled={isEmailing} className="gap-2 rounded-full border-blue-200 text-blue-600 hover:bg-blue-50 flex-shrink-0">
              {isEmailing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Email
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 rounded-full flex-shrink-0">
              <Printer className="w-4 h-4" /> Print
            </Button>
            
            {invoice.status !== 'Draft' && !invoice.ewayBillNo && (
              <Button 
                onClick={() => setIsEWayBillModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-full px-6 flex-shrink-0 shadow-lg shadow-blue-100"
              >
                <Truck className="w-4 h-4" /> Generate E-Way Bill
              </Button>
            )}

            <Button size="sm" onClick={handleDownloadPDF} disabled={isExporting} className="bg-black text-white gap-2 rounded-full px-6 flex-shrink-0">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full flex-shrink-0 ml-auto">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto md:overflow-y-auto p-4 md:p-12 bg-slate-100/50 flex justify-center items-start">
          {currentStyle === 'Thermal' ? (
            <div className="bg-white p-4 md:p-8 shadow-2xl h-fit w-full max-w-[58mm]">
              <ThermalReceipt ref={thermalRef} invoice={invoice} settings={settings} />
            </div>
          ) : (
            <div 
              ref={printRef} 
              id="invoice-print-area"
              className={cn(
                "bg-white shadow-2xl w-full min-w-[794px] md:min-w-0 md:w-[210mm] min-h-[297mm] flex flex-col transition-all duration-500",
                style.font,
                currentStyle === 'Modern' ? 'rounded-2xl' : ''
              )}
            >
            {/* Header */}
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
                  {invoice.irn && (
                    <div className="pt-2 text-right">
                      <div className="text-[8px] uppercase tracking-widest font-black opacity-40">IRN / Ack No</div>
                      <div className="text-[10px] font-mono opacity-60 break-all max-w-[200px] ml-auto leading-tight">{invoice.irn}</div>
                      <div className="text-[8px] font-bold opacity-40 mt-1">Ack Date: {invoice.irnDate ? format(new Date(invoice.irnDate), 'dd/MM/yyyy HH:mm') : '-'}</div>
                    </div>
                  )}
                  <div className="pt-8 space-y-1">
                    <div className="text-[10px] uppercase tracking-widest font-bold opacity-60">Bill Date</div>
                    <div className="text-sm font-bold">{format(new Date(invoice.date), 'dd MMMM yyyy')}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 md:p-16 flex-1 flex flex-col gap-8 md:gap-12">
              {/* Billing Info */}
              <div className="grid grid-cols-2 gap-8 md:gap-16">
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

              {/* Items Table */}
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
                      <tr key={idx} className={cn(currentStyle === 'Modern' && idx % 2 === 1 ? "bg-[#f8fafc]/50" : "")}>
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

              {/* Bottom Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 mt-auto">
                <div className="space-y-6 md:space-y-10">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Total in Words</div>
                    <div className={cn("text-xs italic font-bold leading-relaxed p-4 rounded-lg border", style.border, currentStyle === 'Modern' ? "bg-[#f8fafc]" : "bg-white")}>
                      {amountToWords(invoice.totalAmount, invoice.currency)}
                    </div>
                  </div>
                  
                  {upiUrl && (
                    <div className={cn("flex gap-4 md:gap-6 items-center p-4 md:p-5 rounded-2xl border w-fit", style.border, currentStyle === 'Modern' ? "bg-[#f8fafc]" : "bg-white")}>
                      <QRCodeCanvas value={upiUrl} size={80} level="H" />
                      <div className="space-y-1 md:space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#0f172a]">Instant UPI Payment</div>
                        <div className="text-[10px] text-[#64748b] font-mono font-bold">{settings.upiId}</div>
                      </div>
                    </div>
                  )}

                  {invoice.ewayBillNo && (
                    <div className={cn("p-4 md:p-5 rounded-2xl border w-full space-y-3", style.border, currentStyle === 'Modern' ? "bg-blue-50/50" : "bg-white")}>
                       <div className="flex items-center justify-between">
                         <div className="text-[10px] font-black uppercase tracking-widest text-[#0f172a] flex items-center gap-2">
                           <Truck className="w-3 h-3" /> E-Way Bill Details
                         </div>
                         <Badge className="bg-green-100 text-green-700 font-bold text-[8px] uppercase tracking-tighter ring-0 border-none">Valid</Badge>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                             <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">E-Way Bill No</div>
                             <div className="text-sm font-mono font-bold text-[#0f172a]">{invoice.ewayBillNo}</div>
                          </div>
                          <div className="space-y-1">
                             <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Transport Mode</div>
                             <div className="text-sm font-bold text-[#0f172a]">{invoice.transportMode || 'Road'}</div>
                          </div>
                          <div className="space-y-1">
                             <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Vehicle Number</div>
                             <div className="text-sm font-mono font-bold text-[#0f172a]">{invoice.vehicleNo || '-'}</div>
                          </div>
                          <div className="space-y-1">
                             <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Distance</div>
                             <div className="text-sm font-bold text-[#0f172a]">{invoice.distance ? `${invoice.distance} KM` : '-'}</div>
                          </div>
                       </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Terms of Service</div>
                    <div className="text-[10px] text-[#64748b] whitespace-pre-line leading-relaxed font-medium">
                      {settings.terms}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className={cn("p-6 md:p-8 rounded-2xl space-y-4 border", style.border, currentStyle === 'Modern' ? "bg-slate-950 text-white" : "bg-slate-50")}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="opacity-60 font-black uppercase tracking-widest">Gross Subtotal</span>
                      <span className="font-mono font-bold">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                    </div>
                    {(invoice.totalCgst > 0 || invoice.totalSgst > 0 || invoice.totalIgst > 0) && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="opacity-60 font-black uppercase tracking-widest">Total Taxes</span>
                        <span className="font-mono font-bold">{formatCurrency(invoice.totalCgst + invoice.totalSgst + invoice.totalIgst, invoice.currency)}</span>
                      </div>
                    )}
                    <div className={cn("pt-6 border-t flex justify-between items-center", currentStyle === 'Modern' ? "border-white/10" : "border-[#e2e8f0]")}>
                      <span className="text-sm font-black uppercase tracking-widest">Final Total</span>
                      <span className={cn("text-2xl md:text-3xl font-black font-mono", style.accent)}>{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
                    </div>
                  </div>

                  <div className="pt-6 md:pt-12 flex flex-col items-end gap-3 text-right">
                    {settings.signatureUrl && (
                      <img src={settings.signatureUrl} alt="Signature" className="h-12 md:h-16 w-auto mb-2 mix-blend-multiply brightness-75" />
                    )}
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Authorized Signatory</div>
                    <div className="text-sm font-black text-[#0f172a]">{settings.companyName}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-12 pt-0 flex items-center justify-between">
              <div className="text-[8px] text-[#94a3b8] uppercase font-bold tracking-[0.2em]">
                System ID: {invoice.id.slice(0, 8)}
              </div>
              <div className="text-[8px] text-[#94a3b8] uppercase font-bold tracking-[0.2em] flex items-center gap-3">
                <span>Computer Generated document</span>
                <div className="w-1 h-1 bg-[#cbd5e1] rounded-full" />
                <span className="text-[#0f172a]">Verified by Zeone Engine</span>
              </div>
            </div>
            
            {invoice.extraPages && (
              <div className="p-20 border-t-2 border-dashed border-[#f1f5f9] flex flex-col gap-8 min-h-[297mm]">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Appendix / Scope of Work</div>
                <div className="prose prose-sm max-w-none text-[#475569] whitespace-pre-line leading-relaxed">
                  {invoice.extraPages}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
      <EWayBillForm 
        isOpen={isEWayBillModalOpen}
        onClose={() => setIsEWayBillModalOpen(false)}
        invoice={invoice}
        onSuccess={(updatedInvoice) => {
          setInvoice(updatedInvoice);
        }}
      />
    </div>
  </div>
  );
}
