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
  Truck,
  FileText
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
import { EInvoiceManager } from './EInvoiceManager';
import { Logo } from '../Logo';

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
  const [isEInvoiceModalOpen, setIsEInvoiceModalOpen] = useState(false);
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
              #invoice-print-area { 
                width: 210mm !important;
                height: 296mm !important;
                min-height: 296mm !important;
                box-shadow: none !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                position: relative !important;
              }
              #thermal-receipt {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
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
          #invoice-print-area { background-color: white !important; }
        `;
        clonedDoc.head.appendChild(style);
      }
    });
    
    if (!canvas || canvas.width === 0) {
      throw new Error('Failed to generate image from invoice area');
    }

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
          clonedDoc.querySelectorAll('.dark').forEach(el => el.classList.remove('dark'));
          clonedDoc.querySelectorAll('*').forEach(el => (el as HTMLElement).style.colorScheme = 'light');

          // Identify and and neutralize modern color functions in all style tags
          const styleSheets = clonedDoc.querySelectorAll('style');
          styleSheets.forEach(sheet => {
            if (sheet.innerHTML.includes('okl')) {
              // Replace oklch/oklab with hex or inherit to prevent parsing errors
              // Handling nested parentheses which are common with Tailwind 4 variable lookups
              sheet.innerHTML = sheet.innerHTML.replace(/okl[a-z]{2,3}\s*\([^()]*(\([^()]*\)[^()]*)*\)/gi, '#000000');
            }
          });

          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            try {
              // Reset any inline styles that might use modern color functions
              if (el.style.color?.match(/okl/i)) el.style.color = '#000000';
              if (el.style.backgroundColor?.match(/okl/i)) el.style.backgroundColor = 'transparent';
              if (el.style.borderColor?.match(/okl/i)) el.style.borderColor = '#000000';
            } catch (e) {}
          }
          
          // Inject a solid fallback style tag that uses only standard colors
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root {
              color-scheme: light !important;
              --background: #ffffff !important;
              --foreground: #1e293b !important;
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
      header: "bg-white p-12",
      accent: "text-slate-500",
      border: "border-slate-100",
      font: "font-sans",
      tableHeader: "text-slate-400 font-normal uppercase tracking-widest text-[10px] pb-2",
      heading: "font-light"
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

  const style = styles[currentStyle || 'Standard'];

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
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Professional">Professional</SelectItem>
                <SelectItem value="Classic">Classic</SelectItem>
                <SelectItem value="Modern">Modern</SelectItem>
                <SelectItem value="Simple">Simple</SelectItem>
                <SelectItem value="Creative">Creative</SelectItem>
                <SelectItem value="Detailed">Detailed</SelectItem>
                <SelectItem value="Thermal">Thermal Receipt (58mm)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyLink} 
                disabled={invoice.id === 'draft'}
                className="gap-2 rounded-full flex-shrink-0"
              >
              <LinkIcon className="w-4 h-4" /> Copy
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEmailInvoice} 
                disabled={isEmailing || invoice.id === 'draft'} 
                className="gap-2 rounded-full border-blue-200 text-blue-600 hover:bg-blue-50 flex-shrink-0"
              >
              {isEmailing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Email
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 rounded-full flex-shrink-0">
              <Printer className="w-4 h-4" /> Print
            </Button>
            
            {invoice.id !== 'draft' && invoice.status !== 'Draft' && !invoice.ewayBillNo && (
              <Button 
                onClick={() => setIsEWayBillModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-full px-6 flex-shrink-0 shadow-lg shadow-blue-100"
              >
                <Truck className="w-4 h-4" /> Generate E-Way Bill
              </Button>
            )}

            {invoice.id !== 'draft' && invoice.status !== 'Draft' && !invoice.irn && (
              <Button 
                onClick={() => setIsEInvoiceModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 rounded-full px-6 flex-shrink-0 shadow-lg shadow-indigo-100"
              >
                <FileText className="w-4 h-4" /> E-Invoice Portal
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
                style.font
              )}
            >
            {currentStyle === 'Standard' ? (
              <div className="flex flex-col text-[10px] text-slate-900 bg-white border-2 border-slate-950 m-2">
                {/* PDF-like Header */}
                <div className="p-8 pb-6 flex justify-between items-start border-b-2 border-slate-950">
                  <div className="space-y-4">
                    <h1 className="text-4xl font-black text-blue-900 tracking-tight uppercase leading-tight">
                      {settings.companyName}
                    </h1>
                    <div className="space-y-0.5 text-slate-600 font-medium">
                      <div className="max-w-md uppercase">{settings.address}</div>
                      <div className="flex gap-4 font-bold text-slate-900">
                        <span>GSTIN : {settings.gstin}</span>
                        <span>MOBILE : {settings.phone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 min-w-[300px]">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="h-20 w-auto object-contain mb-2" />
                    ) : (
                      <Logo className="h-16 w-16 mb-2" />
                    )}
                    {(invoice.irn || invoice.ackNo) && (
                      <div className="flex items-start gap-4 border-2 border-[#008080] p-3 bg-white w-full rounded-sm">
                        {invoice.signedQrCode ? (
                          <div className="bg-white p-1">
                            <QRCodeCanvas value={invoice.signedQrCode} size={84} level="M" />
                          </div>
                        ) : (
                          <div className="w-[84px] h-[84px] bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-[8px] font-black uppercase text-slate-400 text-center px-1">QR CODE</div>
                        )}
                        <div className="flex flex-col gap-1 flex-1">
                           <div className="text-[#008080] font-black text-lg leading-none tracking-tighter">GST E-INVOICE</div>
                           <div className="flex flex-col mt-1">
                              <span className="text-[8px] font-black uppercase text-slate-400 leading-none">IRN / ACK NO</span>
                              <span className="text-[10px] font-mono font-bold leading-tight break-all uppercase text-slate-700">{invoice.irn || invoice.ackNo || 'PENDING'}</span>
                           </div>
                           {(invoice.ackDate || invoice.date) && (
                             <div className="flex items-center gap-1 mt-1 font-bold text-slate-500 text-[9px]">
                                <span className="opacity-60 uppercase">Ack Date:</span>
                                <span>{invoice.ackDate ? format(new Date(invoice.ackDate), 'dd/MM/yyyy HH:mm') : format(new Date(invoice.date), 'dd/MM/yyyy 09:24')}</span>
                             </div>
                           )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Header bar */}
                <div className="bg-white border-b-2 border-slate-950 flex divide-x-2 divide-slate-950 font-black uppercase tracking-widest text-[11px]">
                  <div className="flex-1 p-2 px-4">FSSAI : {settings.fssai || 'N/A'}</div>
                  <div className="flex-[2] p-2 px-4 text-center text-base">TAX INVOICE</div>
                  <div className="flex-1 p-2 px-4 text-right">ORIGINAL FOR RECIPIENT</div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 divide-x-2 divide-slate-950 border-b-2 border-slate-950">
                  <div className="p-0 flex flex-col">
                    <div className="bg-slate-50 p-2 border-b-2 border-slate-950 text-center font-black uppercase tracking-wider text-sm">Customer Detail</div>
                    <div className="p-4 grid grid-cols-[100px,1fr] gap-x-2 gap-y-1.5 flex-1">
                      <span className="font-bold opacity-60 uppercase">M/S</span>
                      <span className="font-black text-sm">{invoice.clientName}</span>
                      <span className="font-bold opacity-60 uppercase">Address</span>
                      <span className="font-bold uppercase leading-snug">{invoice.clientAddress}</span>
                      <span className="font-bold opacity-60 uppercase">Mobile</span>
                      <span className="font-black">{invoice.clientPhone || '-'}</span>
                      <span className="font-bold opacity-60 uppercase">GSTIN</span>
                      <span className="font-black">{invoice.clientGstin}</span>
                      <span className="font-bold opacity-60 uppercase">Place of Supply</span>
                      <span className="font-bold">{invoice.clientStateCode}</span>
                    </div>
                  </div>
                  <div className="p-0 border-r-0">
                    <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 font-bold">
                       <div className="space-y-1">
                          <div className="flex justify-between items-baseline gap-2">
                             <span className="opacity-60 text-[9px] uppercase tracking-widest">Invoice No.</span>
                             <span className="font-black">{invoice.invoiceNumber}</span>
                          </div>
                          <div className="flex justify-between items-baseline gap-2">
                             <span className="opacity-60 text-[9px] uppercase tracking-widest">Challan No</span>
                             <span className="font-black">{invoice.challanNo || '-'}</span>
                          </div>
                          <div className="flex justify-between items-baseline gap-2">
                             <span className="opacity-60 text-[9px] uppercase tracking-widest">E-Way Bill No.</span>
                             <span className="font-black">{invoice.ewayBillNo || '-'}</span>
                          </div>
                          <div className="flex justify-between items-baseline gap-2">
                             <span className="opacity-60 text-[9px] uppercase tracking-widest">Transport</span>
                             <span className="font-black">{invoice.transporterName || '-'}</span>
                          </div>
                       </div>
                       <div className="space-y-1">
                          <div className="flex justify-between items-baseline gap-2">
                             <span className="opacity-60 text-[9px] uppercase tracking-widest">Invoice Date</span>
                             <span className="font-black">{format(new Date(invoice.date), 'dd/MM/yyyy')}</span>
                          </div>
                          <div className="flex justify-between items-baseline gap-2">
                             <span className="opacity-60 text-[9px] uppercase tracking-widest">Challan Date</span>
                             <span className="font-black">{invoice.challanDate ? format(new Date(invoice.challanDate), 'dd/MM/yyyy') : '-'}</span>
                          </div>
                          <div className="flex justify-between items-baseline gap-2 mt-4">
                             <span className="opacity-60 text-[9px] uppercase tracking-widest">Transport ID</span>
                             <span className="font-black">{invoice.transporterId || '-'}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="border-b-2 border-slate-950">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-white text-[9px] font-black uppercase tracking-widest text-slate-900 divide-x-2 divide-slate-950 border-b-2 border-slate-950 text-center h-10">
                        <th className="w-10">Sr. No.</th>
                        <th className="text-left px-4">Name of Product / Service</th>
                        <th className="px-2">HSN / SAC</th>
                        <th className="px-2">Qty</th>
                        <th className="px-2 text-right">Rate</th>
                        <th className="px-2 text-right">Taxable Value</th>
                        <th className="p-0 border-b-2 border-slate-950" colSpan={2}>CGST</th>
                        <th className="p-0 border-b-2 border-slate-950" colSpan={2}>SGST</th>
                        <th className="px-4 text-right">Total</th>
                      </tr>
                      <tr className="bg-white text-[8px] font-black uppercase text-slate-900 divide-x-2 divide-slate-950 border-b-2 border-slate-950">
                         <th colSpan={6}></th>
                         <th className="w-8 py-1">%</th>
                         <th className="w-16 py-1 pr-2 text-right">Amount</th>
                         <th className="w-8 py-1">%</th>
                         <th className="w-16 py-1 pr-2 text-right">Amount</th>
                         <th></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className="divide-x-2 divide-slate-950 text-[10px] font-bold align-middle h-10 uppercase">
                          <td className="text-center">{idx + 1}</td>
                          <td className="px-4 text-left font-black">{item.name}</td>
                          <td className="text-center italic text-slate-500">{item.hsn}</td>
                          <td className="text-center">{item.quantity}</td>
                          <td className="text-right px-2 font-mono">₹{item.price.toLocaleString()}</td>
                          <td className="text-right px-2 font-mono">₹{((item.total - (item.cgst + item.sgst + (item.igst || 0)))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-center">{item.gstRate / 2}%</td>
                          <td className="text-right px-2 font-mono">₹{(item.cgst || (item.igst / 2) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-center">{item.gstRate / 2}%</td>
                          <td className="text-right px-2 font-mono">₹{(item.sgst || (item.igst / 2) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-right px-4 font-black">₹{item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-950 font-black bg-white uppercase text-[10px]">
                      <tr className="divide-x-2 divide-slate-950 h-10">
                        <td colSpan={2}></td>
                         <td className="text-center">Total</td>
                        <td className="text-center">{invoice.items.reduce((acc, i) => acc + i.quantity, 0)} NOS</td>
                        <td></td>
                        <td className="text-right px-2 font-mono">₹{invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td colSpan={2} className="text-right px-2 font-mono">₹{(invoice.totalCgst || (invoice.totalIgst / 2) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td colSpan={2} className="text-right px-2 font-mono">₹{(invoice.totalSgst || (invoice.totalIgst / 2) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right px-4 font-black">₹{(invoice.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Summary Section */}
                <div className="grid grid-cols-12 divide-x-2 divide-slate-950 border-b-2 border-slate-950 min-h-[120px]">
                   <div className="col-span-7 flex flex-col">
                      <div className="p-3 border-b-2 border-slate-950 h-24">
                        <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">Total in words</div>
                        <div className="text-sm font-black uppercase italic leading-tight">
                          {amountToWords(invoice.totalAmount, invoice.currency)} ONLY
                        </div>
                      </div>
                    <div className="flex-1 p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-center border-b border-slate-400 mb-2">Bank Details</div>
                        <div className="flex justify-between gap-4">
                           <div className="space-y-1 font-bold">
                             <div className="flex justify-between w-64 text-[10px] items-center"><span className="opacity-50">Name</span> <span>{settings.bankName}</span></div>
                             <div className="flex justify-between w-64 text-[10px] items-center"><span className="opacity-50">Acc. Number</span> <span>{settings.accountNumber}</span></div>
                             <div className="flex justify-between w-64 text-[10px] items-center"><span className="opacity-50">IFSC</span> <span className="font-mono">{settings.ifscCode}</span></div>
                             <div className="flex justify-between w-64 text-[10px] items-center"><span className="opacity-50">UPI ID</span> <span className="font-mono">{settings.upiId}</span></div>
                           </div>
                           {upiUrl && (
                             <div className="flex flex-col items-center gap-1 border-2 border-slate-950 p-1 bg-white">
                               <QRCodeCanvas value={upiUrl} size={84} level="H" />
                               <div className="text-[7px] font-black text-center leading-none mt-1">Pay ₹{invoice.totalAmount.toLocaleString()}<br/>using UPI</div>
                             </div>
                           )}
                        </div>
                      </div>
                   </div>
                    <div className="col-span-5 flex flex-col font-black divide-y-2 divide-slate-950">
                      <div className="flex-1 p-3 space-y-2 text-xs uppercase font-black">
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Taxable Amount</span>
                          <span className="font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Add : CGST</span>
                          <span className="font-mono">{formatCurrency(invoice.totalCgst || (invoice.totalIgst / 2) || 0, invoice.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Add : SGST</span>
                          <span className="font-mono">{formatCurrency(invoice.totalSgst || (invoice.totalIgst / 2) || 0, invoice.currency)}</span>
                        </div>

                        <div className="border-t-2 border-slate-950 pt-2 flex justify-between items-center text-slate-900 font-black">
                          <span>Total Tax</span>
                          <span className="font-mono">{formatCurrency((invoice.totalIgst || 0) + (invoice.totalCgst || 0) + (invoice.totalSgst || 0), invoice.currency)}</span>
                        </div>
                      </div>
                      <div className="h-12 grid grid-cols-[1fr,120px] divide-x-2 divide-slate-950 bg-slate-100 items-center text-sm">
                         <div className="px-2">Total Amount After Tax</div>
                         <div className="px-2 text-right font-black font-mono">{formatCurrency(invoice.totalAmount, invoice.currency)}</div>
                      </div>
                      <div className="flex-1 p-4 flex flex-col justify-between items-center bg-white min-h-[140px]">
                         <div className="text-[8px] italic opacity-60 self-start">Certified that the particulars given above are true and correct.</div>
                         <div className="text-center w-full">
                            <div className="text-xs font-black mb-10">For {settings.companyName.toUpperCase()}</div>
                            {settings.signatureUrl ? (
                              <div className="relative flex flex-col items-center">
                                <img src={settings.signatureUrl} alt="Signature" className="h-16 w-auto mix-blend-multiply brightness-75 -mt-8 mb-2" />
                                <div className="text-[10px] font-black uppercase tracking-widest border-t-2 border-slate-950 pt-2 w-full mx-8">Authorised Signatory</div>
                              </div>
                            ) : (
                              <div className="mt-4 border-t-2 border-slate-950 w-full mx-8 pt-2 text-[10px] font-black">Authorised Signatory</div>
                            )}
                         </div>
                      </div>
                   </div>
                </div>

                {/* Closing Footer */}
                <div className="p-4 flex justify-between items-center text-[10px] font-bold italic">
                   <div className="flex flex-col gap-0.5">
                     <div>Thank you for shopping with us!</div>
                     <div className="not-italic text-[8px] opacity-40">Software Maintain By Zeone Software Mobile:8667586727</div>
                   </div>
                   <div className="not-italic flex items-center gap-4">
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="bg-slate-950 text-white px-2 py-0.5 rounded text-[8px] tracking-widest font-black uppercase">Verified Document</div>
                        <div className="opacity-40 uppercase tracking-tighter text-[7px] font-black">GST Compliant Invoice</div>
                      </div>
                   </div>
                </div>
              </div>
            ) : currentStyle === 'Modern' ? (
              <div className="flex flex-col h-full text-[11px] text-slate-900">
                {/* Modern / Industrial Header */}
                <div className="p-6 md:p-8 flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-4">
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
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="h-20 w-auto object-contain" />
                  ) : (
                    <Logo className="h-20 w-20" />
                  )}
                </div>

                {/* PAN Bar */}
                <div className="border-y border-slate-300 bg-slate-50 flex items-center justify-between px-4 py-1 font-bold text-[10px] md:text-xs uppercase tracking-wider">
                  <div>PAN : <span className="font-mono">{settings.pan || '-'}</span></div>
                  <div className="flex flex-col items-center">
                    <div className="text-sm md:text-lg tracking-tighter">{invoice.type}</div>
                    {invoice.irn && (
                      <div className="text-[7px] text-slate-500 font-mono tracking-tighter mt-0.5">IRN: {invoice.irn.substring(0, 30)}...</div>
                    )}
                  </div>
                  <div>Original for Recipient</div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 border-b border-slate-300 divide-x divide-slate-300">
                  <div className="p-4 space-y-2">
                    <div className="bg-slate-50 -mx-4 -mt-4 mb-2 py-1 px-4 border-b border-slate-300 text-center font-bold text-[10px] uppercase tracking-widest text-slate-600">Customer Detail</div>
                    <div className="grid grid-cols-[80px,1fr] gap-x-2 gap-y-1 mt-2">
                      <div className="font-bold opacity-60">M/S</div>
                      <div className="font-bold">{invoice.clientName}</div>
                      <div className="font-bold opacity-60">Address</div>
                      <div className="leading-snug">{invoice.clientAddress}</div>
                      <div className="font-bold opacity-60">Phone</div>
                      <div className="font-mono">{invoice.clientPhone || '-'}</div>
                      <div className="font-bold opacity-60">GSTIN</div>
                      <div className="font-mono font-bold">{invoice.clientGstin}</div>
                      <div className="font-bold opacity-60">Place of Supply</div>
                      <div>State Code: {invoice.clientStateCode}</div>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="bg-slate-50 -mx-4 -mt-4 mb-2 py-1 px-4 border-b border-slate-300 text-center font-bold text-[10px] uppercase tracking-widest text-slate-600">Invoice Info</div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                       <div className="space-y-1">
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[10px]">
                            <span className="opacity-60">Invoice No.</span>
                            <span className="font-bold font-mono">{invoice.invoiceNumber}</span>
                          </div>
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[10px]">
                            <span className="opacity-60">Challan No</span>
                            <span className="font-bold font-mono">{invoice.challanNo || '-'}</span>
                          </div>
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[10px]">
                            <span className="opacity-60">E-Way Bill No.</span>
                            <span className="font-bold font-mono">{invoice.ewayBillNo || '-'}</span>
                          </div>
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[10px]">
                            <span className="opacity-60">Transport</span>
                            <span className="font-bold">{invoice.transporterName || '-'}</span>
                          </div>
                       </div>
                       <div className="space-y-1">
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[10px]">
                            <span className="opacity-60">Invoice Date</span>
                            <span className="font-bold">{format(new Date(invoice.date), 'dd-MMM-yyyy')}</span>
                          </div>
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[10px]">
                            <span className="opacity-60">Challan Date</span>
                            <span className="font-bold">{invoice.challanDate ? format(new Date(invoice.challanDate), 'dd-MMM-yyyy') : '-'}</span>
                          </div>
                          <div className="grid grid-cols-[80px,1fr] gap-x-2 text-[10px]">
                            <span className="opacity-60">Transport ID</span>
                            <span className="font-bold font-mono text-[9px]">{invoice.transporterId || '-'}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border-b border-slate-300">
                  <table className="w-full h-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold uppercase tracking-widest text-slate-600 divide-x divide-slate-300 border-b border-slate-300">
                        <th className="py-2 px-2 text-center w-10">Sr. No.</th>
                        <th className="py-2 px-4 text-left min-w-[200px]">Name of Product / Service</th>
                        <th className="py-2 px-2 text-center">HSN / SAC</th>
                        <th className="py-2 px-2 text-center">Qty</th>
                        <th className="py-2 px-2 text-right">Rate</th>
                        <th className="py-2 px-2 text-right">Taxable Value</th>
                        <th className="py-2 px-2 text-center border-b border-slate-300" colSpan={2}>CGST / SGST</th>
                        <th className="py-2 px-2 text-right">Total</th>
                      </tr>
                      <tr className="bg-slate-50 text-[8px] font-bold uppercase text-slate-500 divide-x divide-slate-300 border-b border-slate-300">
                        <th colSpan={6}></th>
                        <th className="py-1 px-1 text-center w-10">%</th>
                        <th className="py-1 px-1 text-right min-w-[60px]">Amount</th>
                        <th className=""></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className="divide-x divide-slate-300 text-[10px] align-top">
                          <td className="py-3 px-2 text-center">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold">{item.name}</div>
                          </td>
                          <td className="py-3 px-2 text-center font-mono">{item.hsn}</td>
                          <td className="py-3 px-2 text-center font-bold">{item.quantity} NOS</td>
                          <td className="py-3 px-2 text-right font-mono">{formatCurrency(item.price, invoice.currency)}</td>
                          <td className="py-3 px-2 text-right font-mono font-bold">{formatCurrency((item.quantity * item.price), invoice.currency)}</td>
                          <td className="py-3 px-2 text-center font-mono">{item.gstRate / 2}%</td>
                          <td className="py-3 px-2 text-right font-mono italic">
                              <div className="space-y-0.5">
                                <div>C: {formatCurrency(item.cgst || (item.igst / 2) || 0, invoice.currency)}</div>
                                <div>S: {formatCurrency(item.sgst || (item.igst / 2) || 0, invoice.currency)}</div>
                              </div>
                          </td>
                          <td className="py-3 px-2 text-right font-bold font-mono">{formatCurrency(item.total, invoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-300 font-bold bg-slate-50">
                       <tr className="divide-x divide-slate-300 text-[10px]">
                          <td colSpan={2} className="py-2 px-4 text-right uppercase tracking-widest text-[#008080]">Total</td>
                          <td></td>
                          <td className="text-center">{invoice.items.reduce((acc, item) => acc + item.quantity, 0)} NOS</td>
                          <td></td>
                          <td className="text-right font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
                          <td></td>
                          <td className="text-right font-mono">{formatCurrency(invoice.totalIgst + invoice.totalCgst + invoice.totalSgst, invoice.currency)}</td>
                          <td className="text-right font-mono">{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
                       </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Summary Section */}
                <div className="grid grid-cols-12 divide-x divide-slate-300 border-b border-slate-300">
                   <div className="col-span-8 p-4">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Total in words</div>
                      <div className="text-xs font-black uppercase tracking-tight text-slate-700 italic">
                        {amountToWords(invoice.totalAmount, invoice.currency)} ONLY
                      </div>
                   </div>
                   <div className="col-span-4 p-3 space-y-2 font-bold text-[10px]">
                      <div className="flex justify-between items-center text-slate-500">
                        <span className="uppercase tracking-tight text-[9px]">Taxable Amount</span>
                        <span className="font-mono text-slate-900">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-slate-500">
                        <span className="uppercase tracking-tight text-[9px]">Add: CGST</span>
                        <span className="font-mono text-slate-800">{formatCurrency(invoice.totalCgst || (invoice.totalIgst / 2) || 0, invoice.currency)}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span className="uppercase tracking-tight text-[9px]">Add: SGST</span>
                        <span className="font-mono text-slate-800">{formatCurrency(invoice.totalSgst || (invoice.totalIgst / 2) || 0, invoice.currency)}</span>
                      </div>

                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
                         <span className="uppercase tracking-widest text-[#008080] text-[9px]">Total Tax</span>
                         <span className="font-mono font-black text-slate-900">{formatCurrency((invoice.totalIgst || 0) + (invoice.totalCgst || 0) + (invoice.totalSgst || 0), invoice.currency)}</span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-12 divide-x divide-slate-300 border-b border-slate-300">
                   <div className="col-span-8">
                      <div className="bg-slate-50 py-1 px-4 border-b border-slate-300 text-center font-bold text-[10px] uppercase tracking-widest text-slate-600">Bank Details</div>
                      <div className="p-4 flex justify-between gap-4">
                        <div className="grid grid-cols-[100px,1fr] gap-x-2 gap-y-1 text-[10px] flex-1">
                          <div className="font-bold opacity-60">Name</div>
                          <div className="font-bold">{settings.bankName}</div>
                          <div className="font-bold opacity-60">Branch</div>
                          <div>{settings.bankBranch || '-'}</div>
                          <div className="font-bold opacity-60">Acc. Number</div>
                          <div className="font-mono font-bold">{settings.accountNumber}</div>
                          <div className="font-bold opacity-60">IFSC</div>
                          <div className="font-mono font-bold">{settings.ifscCode}</div>
                          <div className="font-bold opacity-60 mt-2">UPI ID</div>
                          <div className="font-mono font-bold mt-2">{settings.upiId || '-'}</div>
                        </div>
                        {upiUrl && (
                          <div className="flex flex-col items-center gap-1 border-l pl-4 border-slate-200">
                            <QRCodeCanvas value={upiUrl} size={80} level="H" />
                            <div className="text-[8px] font-bold uppercase tracking-tighter">Pay using UPI</div>
                          </div>
                        )}
                      </div>
                   </div>
                   <div className="col-span-4 flex flex-col">
                      <div className="flex justify-between p-3 border-b border-slate-300 font-black text-xs md:text-sm bg-slate-50">
                        <span>Total Amount After Tax</span>
                        <span className="text-[#008080]">{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
                      </div>
                      <div className="flex-1 p-4 flex flex-col justify-between items-center relative overflow-hidden">
                        <div className="text-[8px] self-end font-bold opacity-40">(E & O.E.)</div>
                        
                        <div className="text-center space-y-4 pt-4">
                           <div className="text-[9px] font-bold text-slate-500 max-w-[180px]">Certified that the particulars given above are true and correct.</div>
                           <div className="font-black text-xs uppercase tracking-wider">For {settings.companyName}</div>
                        </div>

                        {settings.signatureUrl ? (
                          <div className="flex flex-col items-center gap-2 mt-4">
                            <img src={settings.signatureUrl} alt="Signature" className="h-16 w-auto mix-blend-multiply brightness-75" />
                            <div className="text-[10px] font-bold uppercase tracking-widest border-t border-slate-300 pt-1 w-full text-center">Authorised Signatory</div>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-400 italic mt-8 text-center border-t border-slate-200 pt-4 w-full">
                            This is a computer generated invoice no signature required.
                          </div>
                        )}
                      </div>
                   </div>
                </div>

                {/* Terms and Conditions Section */}
                <div className="p-4 bg-white border-b border-slate-300">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#008080] mb-2">Terms and Conditions</div>
                  <div className="text-[9px] text-slate-600 whitespace-pre-line leading-relaxed italic border-l-2 border-[#008080] pl-4 py-1">
                    {settings.terms}
                  </div>
                </div>

                <div className="p-4 flex justify-between items-center text-[10px] font-bold text-slate-500 italic mt-auto">
                   <div className="flex flex-col gap-1">
                     <div>Thank you for shopping with us!</div>
                     {invoice.createdBy && (
                       <div className="not-italic text-[9px] font-bold text-slate-400">Billed By: {invoice.createdBy.name}</div>
                     )}
                   </div>
                   <div className="opacity-40 uppercase tracking-[0.3em] font-sans not-italic text-[8px]">Powered by Zeone Engine</div>
                </div>
              </div>
            ) : (
               <>
                 {/* Standard Header */}
                 <div className={style.header}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-6">
                      {settings.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
                      ) : (
                        <Logo className="h-16 w-16" />
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
                          <div className="text-[10px] md:text-sm font-black uppercase tracking-tight text-[#008080]">GST E-Invoice</div>
                          <div className="text-[8px] uppercase tracking-widest font-black opacity-40">IRN / Ack No</div>
                          <div className="text-[10px] font-mono opacity-60 break-all max-w-[300px] ml-auto leading-tight">{invoice.irn}</div>
                          <div className="text-[8px] font-bold opacity-40 mt-1">Ack Date: {invoice.ackDate || invoice.irnDate ? format(new Date(invoice.ackDate || invoice.irnDate || ''), 'dd/MM/yyyy HH:mm') : '-'}</div>
                          {invoice.signedQrCode && (
                            <div className="mt-2 flex justify-end">
                              <QRCodeCanvas value={invoice.signedQrCode} size={80} level="H" />
                            </div>
                          )}
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
                          <tr key={idx} className="">
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
                        <div className={cn("text-xs italic font-bold leading-relaxed p-4 rounded-lg border", style.border, "bg-white")}>
                          {amountToWords(invoice.totalAmount, invoice.currency)}
                        </div>
                      </div>
                      
                      {upiUrl && (
                        <div className={cn("flex gap-4 md:gap-6 items-center p-4 md:p-5 rounded-2xl border w-fit", style.border, "bg-white")}>
                          <QRCodeCanvas value={upiUrl} size={80} level="H" />
                          <div className="space-y-1 md:space-y-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#0f172a]">Instant UPI Payment</div>
                            <div className="text-[10px] text-[#64748b] font-mono font-bold">{settings.upiId}</div>
                          </div>
                        </div>
                      )}

                      {invoice.ewayBillNo && (
                        <div className={cn("p-4 md:p-5 rounded-2xl border w-full space-y-3", style.border, "bg-white")}>
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
                      <div className={cn("p-6 md:p-8 rounded-2xl space-y-4 border", style.border, "bg-slate-50")}>
                        <div className="flex justify-between items-center text-xs">
                          <span className="opacity-60 font-black uppercase tracking-widest">Gross Subtotal</span>
                          <span className="font-mono font-bold">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="opacity-60 font-black uppercase tracking-widest">CGST Total</span>
                          <span className="font-mono font-bold">{formatCurrency(invoice.totalCgst || 0, invoice.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="opacity-60 font-black uppercase tracking-widest">SGST Total</span>
                          <span className="font-mono font-bold">{formatCurrency(invoice.totalSgst || 0, invoice.currency)}</span>
                        </div>
                        <div className={cn("pt-6 border-t flex justify-between items-center", "border-[#e2e8f0]")}>
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
                  <div className="text-[8px] text-[#94a3b8] uppercase font-bold tracking-[0.2em] flex flex-col gap-1">
                    <div>System ID: {invoice.id.slice(0, 8)}</div>
                    {invoice.createdBy && (
                      <div className="text-[#64748b]">Issued By: {invoice.createdBy.name}</div>
                    )}
                  </div>
                  <div className="text-[8px] text-[#94a3b8] uppercase font-bold tracking-[0.2em] flex items-center gap-3">
                    <span>Computer Generated document</span>
                    <div className="w-1 h-1 bg-[#cbd5e1] rounded-full" />
                    <span className="text-[#0f172a]">Verified by Zeone Engine</span>
                  </div>
                 </div>
               </>
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

        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print-area, #invoice-print-area * {
            visibility: visible;
          }
          #invoice-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm !important;
            height: 296mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
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
      {isEInvoiceModalOpen && (
        <EInvoiceManager
          invoice={invoice}
          settings={settings}
          onUpdate={(updatedInvoice) => setInvoice(updatedInvoice)}
          onClose={() => setIsEInvoiceModalOpen(false)}
        />
      )}
    </div>
  </div>
  );
}
