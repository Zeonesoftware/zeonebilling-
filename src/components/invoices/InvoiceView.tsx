import React, { useRef, useState } from 'react';
import { 
  Download, 
  Printer, 
  X, 
  Share2, 
  Loader2,
  Globe,
  Truck,
  FileText,
  CheckCircle2
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
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  const [isEWayBillModalOpen, setIsEWayBillModalOpen] = useState(false);
  const [isEInvoiceModalOpen, setIsEInvoiceModalOpen] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<Invoice['pdfStyle'] | 'Thermal'>(
    initialStyle || invoice.pdfStyle || settings.defaultPdfStyle || 'Professional'
  );
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>(initialStyle === 'Simple' ? 'A5' : 'A4');

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

    const selectedPaperSize = paperSize;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${invoice.invoiceNumber}</title>
          ${styles}
          <style>
            @media print {
              @page { 
                size: ${currentStyle === 'Thermal' ? '58mm auto' : selectedPaperSize}; 
                margin: 0 !important; 
              }
              body { margin: 0 !important; padding: 0 !important; background: white !important; }
              #invoice-print-area { 
                width: ${selectedPaperSize === 'A5' ? '148mm' : '210mm'} !important;
                height: ${selectedPaperSize === 'A5' ? '210mm' : '296mm'} !important;
                min-height: ${selectedPaperSize === 'A5' ? '210mm' : '296mm'} !important;
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

  const handleDownloadPDF = async () => {
    const element = printRef.current;
    if (!element) {
      toast.error('Preview not ready');
      return;
    }

    try {
      setIsExporting(true);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200, // Ensure we capture with a consistent width
        onclone: (clonedDoc) => {
          // Remove dark mode class from the cloned document to avoid oklch/oklab issues
          const html = clonedDoc.documentElement;
          html.classList.remove('dark');
          clonedDoc.body.classList.remove('dark');

          // Find the capture element in the clone and force its width to A4
          const captureEl = clonedDoc.getElementById('invoice-print-area');
          if (captureEl) {
            captureEl.style.width = '210mm';
            captureEl.style.minWidth = '210mm';
            captureEl.style.margin = '0';
            captureEl.style.padding = '0';
          }

          // Aggressively replace oklch and oklab in all stylesheets and inline styles
          const sanitizeStyle = (css: string) => css.replace(/(oklch|oklab)\s*\([^)]+\)/g, '#000000');
          
          clonedDoc.querySelectorAll('style').forEach(styleTag => {
            styleTag.innerHTML = sanitizeStyle(styleTag.innerHTML);
          });
          
          clonedDoc.querySelectorAll('[style]').forEach(el => {
            const style = el.getAttribute('style');
            if (style) el.setAttribute('style', sanitizeStyle(style));
          });

          // Iterate through stylesheets and try to remove problematic rules
          try {
            Array.from(clonedDoc.styleSheets).forEach(sheet => {
              try {
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) return;
                for (let i = rules.length - 1; i >= 0; i--) {
                  if (rules[i].cssText.includes('oklch') || rules[i].cssText.includes('oklab')) {
                    sheet.deleteRule(i);
                  }
                }
              } catch (e) {
                // Some sheets might be cross-origin
              }
            });
          } catch (e) {}

          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            :root, .dark {
              --background: #ffffff !important;
              --foreground: #000000 !important;
              --primary: #000000 !important;
              --primary-foreground: #ffffff !important;
              --card: #ffffff !important;
              --card-foreground: #000000 !important;
              --border: #000000 !important;
              --border-width: 1px !important;
              --input: #000000 !important;
              --ring: #000000 !important;
              --secondary: #f1f5f9 !important;
              --secondary-foreground: #000000 !important;
              --muted: #f1f5f9 !important;
              --muted-foreground: #64748b !important;
              --accent: #f1f5f9 !important;
              --accent-foreground: #000000 !important;
              --tw-ring-color: #000000 !important;
              --tw-border-color: #000000 !important;
              --tw-ring-offset-color: #ffffff !important;
            }
            * {
               color-scheme: light !important;
               -webkit-print-color-adjust: exact !important;
               font-family: 'Inter', sans-serif !important;
            }
            .font-mono { font-family: monospace !important; }
          `;
          clonedDoc.head.appendChild(style);
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      if (imgData === 'data:,') throw new Error('Failed to capture image');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: paperSize.toLowerCase()
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      pdf.save(`Invoice-${invoice.invoiceNumber}.pdf`);
      
      toast.success('PDF Downloaded successfully');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast.error('Failed to generate PDF.');
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

  const style = (styles as any)[currentStyle || 'Standard'] || styles.Standard;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-auto">
      <div className="bg-white w-full max-w-5xl h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className={cn("flex flex-col md:flex-row items-start md:items-center justify-between px-6 py-4 border-b bg-white sticky top-0 z-20 gap-4", style.font)}>
          <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <h3 className="font-bold flex-shrink-0">Preview</h3>
            <Select 
              value={currentStyle || ""} 
              onValueChange={(v: any) => {
                setCurrentStyle(v);
                if (v === 'Simple') setPaperSize('A5');
                else if (v !== 'Thermal') setPaperSize('A4');
              }}
            >
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
            <Select value={paperSize} onValueChange={(v: any) => setPaperSize(v)}>
              <SelectTrigger className="w-24 h-9 font-bold flex-shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="A5">A5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
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

            {invoice.irn && invoice.einvoiceStatus === 'Generated' && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full flex-shrink-0">
                <Badge className="bg-indigo-600 text-white font-black uppercase text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1.5 ring-2 ring-indigo-100">
                  <CheckCircle2 className="w-3 h-3" /> E-Invoice Generated
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1 font-bold rounded-full px-3"
                  onClick={() => setIsEInvoiceModalOpen(true)}
                >
                  <X className="w-3 h-3" /> Cancel
                </Button>
              </div>
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
              <div className="flex flex-col text-[11px] text-black bg-white border-[3px] border-black m-0 md:m-2">
                <div className="p-8 pb-6 flex justify-between items-start border-b-[3px] border-black">
                  <div className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-black text-[#003366] tracking-tight uppercase leading-none">
                      {settings.companyName}
                    </h1>
                    <div className="space-y-1 text-black font-bold text-[12px]">
                      <div className="max-w-md uppercase leading-relaxed">{settings.address}</div>
                      <div className="flex gap-x-8 gap-y-1 font-black text-black flex-wrap mt-2 pt-2 border-t border-black/10">
                        <span className="flex items-center gap-1"><span className="opacity-50 text-[10px]">GSTIN</span> {settings.gstin}</span>
                        <span className="flex items-center gap-1"><span className="opacity-50 text-[10px]">MOBILE</span> {settings.phone}</span>
                        <span className="flex items-center gap-1"><span className="opacity-50 text-[10px]">EMAIL</span> {settings.email}</span>
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
                      <div className="flex items-start gap-4 border-[2px] border-black p-3 bg-white w-full rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        {invoice.signedQrCode ? (
                          <div className="bg-white p-1">
                            <QRCodeCanvas value={invoice.signedQrCode} size={92} level="M" />
                          </div>
                        ) : (
                          <div className="w-[92px] h-[92px] bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-[8px] font-black uppercase text-slate-400 text-center px-1">QR CODE</div>
                        )}
                        <div className="flex flex-col gap-1.5 flex-1 lg:max-w-[180px]">
                           <div className="text-black font-black text-lg leading-none tracking-tighter uppercase border-b-2 border-black pb-1">E-INVOICE</div>
                           <div className="flex flex-col mt-1">
                              <span className="text-[9px] font-black uppercase text-slate-500 leading-none">IRN / ACK NO</span>
                              <span className="text-[10px] font-mono font-black border-l-2 border-black pl-2 py-0.5 mt-1 leading-tight break-all uppercase text-black">{invoice.irn || invoice.ackNo || 'PENDING'}</span>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Header bar */}
                <div className="bg-slate-50 border-b-[3px] border-black flex divide-x-[3px] divide-black font-black uppercase tracking-[0.1em] text-[11px] h-12 items-center">
                  <div className="flex-1 px-6 whitespace-nowrap">FSSAI : {settings.fssai || 'N/A'}</div>
                  <div className="flex-[2] px-6 text-center text-xl tracking-[0.2em] font-black">TAX INVOICE</div>
                  <div className="flex-1 px-6 text-right whitespace-nowrap">ORIGINAL COPY</div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 divide-x-[3px] divide-black border-b-[3px] border-black">
                  <div className="p-0 flex flex-col">
                    <div className="bg-black text-white p-2.5 text-center font-black uppercase tracking-[0.1em] text-[12px]">Bill To (Recipient)</div>
                    <div className="p-6 grid grid-cols-[110px,1fr] gap-x-4 gap-y-3 flex-1 text-[12px]">
                      <span className="font-black opacity-40 uppercase tracking-tighter text-[10px] self-center">Customer Name</span>
                      <span className="font-black text-lg uppercase leading-none border-b-2 border-black/5 pb-1">{invoice.clientName}</span>
                      
                      <span className="font-black opacity-40 uppercase tracking-tighter text-[10px]">Address</span>
                      <span className="font-black uppercase leading-relaxed">{invoice.clientAddress}</span>
                      
                      <span className="font-black opacity-40 uppercase tracking-tighter text-[10px]">Mobile</span>
                      <span className="font-black text-[13px]">{invoice.clientPhone || '-'}</span>
                      
                      <span className="font-black opacity-40 uppercase tracking-tighter text-[10px]">GSTIN</span>
                      <span className="font-black uppercase text-[13px] bg-slate-100 px-2 py-0.5 w-fit rounded-sm">{invoice.clientGstin}</span>
                      
                      <span className="font-black opacity-40 uppercase tracking-tighter text-[10px]">Place of Supply</span>
                      <span className="font-black uppercase">{invoice.clientStateCode}</span>
                    </div>
                  </div>
                  <div className="p-0">
                    <div className="bg-black text-white p-2.5 text-center font-black uppercase tracking-[0.1em] text-[12px]">Invoice Information</div>
                    <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-6 font-black h-full text-[12px]">
                       <div className="space-y-5">
                          <div className="flex flex-col gap-1 border-l-4 border-black pl-3">
                             <span className="opacity-40 text-[9px] font-black uppercase tracking-widest leading-none">Invoice Number</span>
                             <span className="font-black text-[15px] leading-none text-blue-900">{invoice.invoiceNumber}</span>
                          </div>
                          <div className="flex flex-col gap-1 border-l-4 border-black/40 pl-3">
                             <span className="opacity-40 text-[9px] font-black uppercase tracking-widest leading-none">Challan Number</span>
                             <span className="font-black text-[13px] leading-none">{invoice.challanNo || '-'}</span>
                          </div>
                          <div className="flex flex-col gap-1 border-l-4 border-black/40 pl-3">
                             <span className="opacity-40 text-[9px] font-black uppercase tracking-widest leading-none">E-Way Bill</span>
                             <span className="font-black text-[13px] leading-none">{invoice.ewayBillNo || '-'}</span>
                          </div>
                       </div>
                       <div className="space-y-5">
                          <div className="flex flex-col gap-1 border-l-4 border-black pl-3">
                             <span className="opacity-40 text-[9px] font-black uppercase tracking-widest leading-none">Invoice Date</span>
                             <span className="font-black text-[15px] leading-none">{format(new Date(invoice.date), 'dd/MM/yyyy')}</span>
                          </div>
                          <div className="flex flex-col gap-1 border-l-4 border-black/40 pl-3">
                             <span className="opacity-40 text-[9px] font-black uppercase tracking-widest leading-none">Order Ref</span>
                             <span className="font-black text-[13px] leading-none">{invoice.orderRef || '-'}</span>
                          </div>
                          <div className="flex flex-col gap-1 border-l-4 border-black/40 pl-3">
                             <span className="opacity-40 text-[9px] font-black uppercase tracking-widest leading-none">Transporter</span>
                             <span className="font-black text-[11px] leading-tight uppercase line-clamp-2">{invoice.transporterName || '-'}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border-b-[3px] border-black overflow-hidden flex-1">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-[10px] font-black uppercase tracking-[0.1em] text-white divide-x-2 divide-white/20 border-b-[3px] border-black text-center h-12">
                        <th className="w-12">Sr.</th>
                        <th className="text-left px-6">Description of Goods</th>
                        <th className="w-24">HSN/SAC</th>
                        <th className="w-20">Quantity</th>
                        <th className="w-32 text-right px-4">Rate</th>
                        <th className="w-32 text-right px-4">Net Amount</th>
                        <th className="text-center w-16" colSpan={1}>GST %</th>
                        <th className="w-32 text-right px-4">Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className="divide-x-2 divide-black text-[11px] font-black align-middle h-11 uppercase text-black">
                          <td className="text-center bg-slate-50">{idx + 1}</td>
                          <td className="px-6 text-left font-black text-[13px]">{item.name}</td>
                          <td className="text-center font-mono opacity-60">{item.hsn}</td>
                          <td className="text-center text-sm">{item.quantity} <span className="text-[10px] opacity-40">{item.unit || 'PCS'}</span></td>
                          <td className="text-right px-4 font-mono text-sm">₹{item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="text-right px-4 font-mono text-sm bg-slate-50/50">₹{((item.total - (item.cgst + item.sgst + (item.igst || 0)))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="text-center font-black bg-slate-100">{item.gstRate}%</td>
                          <td className="text-right px-4 font-black text-sm bg-slate-50">₹{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      {/* Empty rows */}
                      {Array.from({ length: Math.max(0, 12 - invoice.items.length) }).map((_, i) => (
                        <tr key={`empty-${i}`} className="divide-x-2 divide-black h-11 border-b border-black/5">
                           <td colSpan={8}></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer totals bar */}
                <div className="bg-slate-900 text-white flex divide-x-2 divide-slate-700 font-black uppercase text-[12px] h-12 items-center border-b-[3px] border-black">
                   <div className="flex-1 px-6">Total Items: {invoice.items.length}</div>
                   <div className="flex-1 px-6 text-center">Total Quantity: {invoice.items.reduce((acc, i) => acc + i.quantity, 0)}</div>
                   <div className="w-[300px] px-6 text-right text-base italic flex justify-between items-center bg-slate-800">
                      <span className="text-[10px] opacity-50 tracking-widest">SUB TOTAL</span>
                      <span className="font-mono">₹{invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                   </div>
                </div>

                {/* Summary Section */}
                <div className="grid grid-cols-12 divide-x-[3px] divide-black border-b-[3px] border-black min-h-[160px] text-black">
                   <div className="col-span-7 flex flex-col">
                      <div className="p-6 border-b-[3px] border-black bg-slate-50 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-widest mb-3 text-slate-400">Total in words</div>
                        <div className="text-[15px] font-black uppercase italic leading-tight text-blue-900 pr-12 underline underline-offset-4 decoration-black/20">
                          {amountToWords(invoice.totalAmount, invoice.currency)} ONLY
                        </div>
                      </div>
                      <div className="p-6 flex gap-6 items-start bg-white">
                         <div className="flex-1 space-y-3 font-black text-[12px]">
                            <div className="text-[10px] uppercase tracking-widest text-slate-400 border-b border-black/10 pb-1 mb-2">Our Bank Information</div>
                            <div className="flex justify-between items-center"><span className="opacity-40 uppercase text-[9px]">S/A Name</span> <span className="uppercase text-sm border-l-4 border-black pl-3">{settings.companyName}</span></div>
                            <div className="flex justify-between items-center"><span className="opacity-40 uppercase text-[9px]">A/C Number</span> <span className="font-mono text-base bg-slate-100 px-2 rounded-sm">{settings.accountNumber}</span></div>
                            <div className="flex justify-between items-center"><span className="opacity-40 uppercase text-[9px]">Branch/IFSC</span> <span className="uppercase">{settings.bankName} / {settings.ifscCode}</span></div>
                         </div>
                         {upiUrl && (
                           <div className="flex flex-col items-center gap-2 border-[3px] border-black p-3 bg-white rounded-md shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
                             <QRCodeCanvas value={upiUrl} size={100} level="H" />
                             <div className="text-[10px] font-black text-center leading-none mt-1 uppercase tracking-tighter">Payable: ₹{invoice.totalAmount.toLocaleString()}</div>
                           </div>
                         )}
                      </div>
                   </div>
                    <div className="col-span-5 flex flex-col divide-y-[3px] divide-black">
                      <div className="p-6 space-y-4 text-[13px] uppercase font-black bg-white flex-1">
                        <div className="flex justify-between items-center border-b border-black/5 pb-2">
                          <span className="opacity-40 text-[10px]">Net Taxable Value</span>
                          <span className="font-mono text-lg">₹{invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div className="space-y-4">
                           <div className="flex justify-between items-center text-slate-600">
                             <span className="opacity-60 text-[10px]">Add: CGST Output</span>
                             <span className="font-mono">₹{(invoice.totalCgst || (invoice.totalIgst / 2) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                           </div>
                           <div className="flex justify-between items-center text-slate-600">
                             <span className="opacity-60 text-[10px]">Add: SGST Output</span>
                             <span className="font-mono">₹{(invoice.totalSgst || (invoice.totalIgst / 2) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                           </div>
                        </div>

                        <div className="border-t-[3px] border-black pt-4 mt-2 flex justify-between items-center text-black bg-slate-50 -mx-6 px-6 py-2">
                          <span className="text-[12px] tracking-[0.1em]">Grand Total (Round Off)</span>
                          <span className="font-black font-mono text-2xl text-blue-950">₹{invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className="p-6 flex flex-col justify-between items-center bg-white min-h-[180px] text-center">
                         <div className="text-[10px] italic font-bold opacity-60 self-start border-l-4 border-red-600 pl-3 leading-relaxed">Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
                         
                         <div className="w-full mt-8">
                            <div className="text-[12px] font-black mb-12 uppercase tracking-[0.2em]">{settings.companyName.toUpperCase()}</div>
                            {settings.signatureUrl ? (
                              <div className="relative flex flex-col items-center">
                                <img src={settings.signatureUrl} alt="Signature" className="h-20 w-auto mix-blend-multiply brightness-50 absolute -top-16 z-10" />
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] border-t-[3px] border-black pt-3 w-full">Authorised Representative</div>
                              </div>
                            ) : (
                              <div className="border-t-[3px] border-black w-full pt-3 text-[11px] font-black uppercase tracking-[0.2em]">Authorised Representative</div>
                            )}
                         </div>
                      </div>
                   </div>
                </div>

                {/* Final Bar */}
                <div className="p-4 px-8 flex justify-between items-center bg-slate-50 text-[11px] font-black text-black">
                   <div className="flex items-center gap-6">
                      <div className="text-xl italic font-black text-blue-900 tracking-tighter">THANK YOU!</div>
                      <div className="h-8 w-px bg-black/20"></div>
                      <div className="flex flex-col text-[8px] opacity-40 leading-tight">
                         <span>GST COMPLIANT DIGITAL INVOICE</span>
                         <span>GENERATED ON: {format(new Date(), 'dd MMM yyyy HH:mm')}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="text-right flex flex-col">
                         <span className="text-[9px] uppercase tracking-widest">Verified document</span>
                         <span className="text-[7px] opacity-50">Powered by Zeone Billing Solutions</span>
                      </div>
                   </div>
                </div>
              </div>
            ) : currentStyle === 'Modern' ? (
              <div className="flex flex-col h-full text-[11px] text-black border-[3px] border-black m-0 md:m-2">
                {/* Modern / Industrial Header */}
                <div className="p-6 md:p-8 flex justify-between items-start gap-4 text-left">
                  <div className="flex-1 space-y-4">
                    <div className="text-4xl md:text-5xl font-black tracking-tighter text-black leading-none uppercase">
                      {settings.companyName}
                    </div>
                    <div className="flex flex-col gap-1 text-[10px] md:text-sm font-bold text-black pt-2">
                       <div className="max-w-[400px] leading-relaxed italic uppercase font-medium">{settings.address}</div>
                       <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 border-t border-black/10 pt-2 text-[11px] md:text-xs">
                          <div className="flex items-center gap-1.5 font-black">
                            <span className="opacity-40 text-[9px]">TEL:</span> {settings.phone}
                          </div>
                          <div className="flex items-center gap-1.5 font-black">
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
                              <span className="text-[9px] font-mono font-bold leading-tight break-all uppercase text-slate-900 border-l-2 border-black pl-2 leading-none py-1">
                                {invoice.irn || invoice.ackNo}
                              </span>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* PAN / GST Bar */}
                <div className="border-y-2 border-black bg-slate-50 flex items-center justify-between px-4 py-2 font-black text-[10px] md:text-xs uppercase tracking-wider text-black">
                  <div>PAN : <span className="font-mono">{settings.pan || '-'}</span></div>
                  <div className="flex flex-col items-center">
                    <div className="text-sm md:text-lg tracking-tighter font-black underline underline-offset-4">{invoice.type?.toUpperCase()}</div>
                  </div>
                  <div>ORIGINAL FOR RECIPIENT</div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 border-b-2 border-black divide-x-2 divide-black text-black">
                  <div className="p-4 space-y-2 text-left">
                    <div className="bg-slate-100 -mx-4 -mt-4 mb-2 py-1.5 px-4 border-b-2 border-black text-center font-black text-[10px] uppercase tracking-widest text-black">Customer Details</div>
                    <div className="grid grid-cols-[80px,1fr] gap-x-2 gap-y-1 mt-2">
                      <div className="font-bold opacity-70 uppercase text-[9px]">M/S</div>
                      <div className="font-black text-sm uppercase">{invoice.clientName}</div>
                      <div className="font-bold opacity-70 uppercase text-[9px]">Address</div>
                      <div className="leading-snug font-bold uppercase">{invoice.clientAddress}</div>
                      <div className="font-bold opacity-70 uppercase text-[9px]">GSTIN / Mobile</div>
                      <div className="font-mono font-black">{invoice.clientGstin} / {invoice.clientPhone || '-'}</div>
                    </div>
                  </div>
                  <div className="p-4 space-y-2 text-left">
                    <div className="bg-slate-100 -mx-4 -mt-4 mb-2 py-1.5 px-4 border-b-2 border-black text-center font-black text-[10px] uppercase tracking-widest text-black">Invoice Information</div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                       <div className="space-y-2">
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <span className="opacity-50 font-black uppercase text-[8px]">Invoice No.</span>
                            <span className="font-black font-mono text-xs">{invoice.invoiceNumber}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <span className="opacity-50 font-black uppercase text-[8px]">Challan No</span>
                            <span className="font-bold">{invoice.challanNo || '-'}</span>
                          </div>
                       </div>
                       <div className="space-y-2">
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <span className="opacity-50 font-black uppercase text-[8px]">Date</span>
                            <span className="font-bold font-mono text-xs">{format(new Date(invoice.date), 'dd/MM/yyyy')}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <span className="opacity-50 font-black uppercase text-[8px]">Transport</span>
                            <span className="font-bold uppercase leading-tight text-[9px]">{invoice.transporterName || '-'}</span>
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
            ) : currentStyle === 'Simple' ? (
              <div 
                className={cn(
                  "flex flex-col text-[9px] text-black bg-white border-2 border-black m-1",
                  (paperSize === 'A5' || currentStyle === 'Simple') ? "w-[148mm] min-h-[210mm]" : "w-[210mm] min-h-[297mm]"
                )}
              >
                {/* Image-style Header */}
                <div className="p-2 border-b-2 border-black">
                  <div className="flex justify-between items-start text-[8px] font-bold">
                    <div className="space-y-0.5">
                      <div>GSTIN:{settings.gstin}</div>
                      <div>FASSAI NO:{settings.fssai || 'N/A'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-black uppercase tracking-widest border-b border-black pb-0.5 mb-1 px-4">TAX INVOICE</div>
                    </div>
                    <div>MOBILE:{settings.phone}</div>
                  </div>
                  
                  <div className="text-center mt-1 space-y-0.5">
                    <h1 className="text-xl font-black tracking-tighter uppercase leading-none">{settings.companyName}</h1>
                    <div className="text-[8px] font-bold uppercase">{settings.address}</div>
                  </div>
                </div>

                {/* Sub-Header bar - Invoice No & Date */}
                <div className="border-b-2 border-black flex divide-x-2 divide-black font-bold uppercase text-[9px]">
                  <div className="flex-1 p-1 px-2">Invoice No:{invoice.invoiceNumber}</div>
                  <div className="flex-1 p-1 px-2 text-right">DATE: {format(new Date(invoice.date), 'dd-MM-yyyy')}</div>
                </div>

                {/* Info Grid - Bill To & State info */}
                <div className="grid grid-cols-2 divide-x-2 divide-black border-b-2 border-black">
                  <div className="p-1.5 space-y-0.5">
                    <div className="grid grid-cols-[60px,1fr] gap-x-1">
                      <span className="font-bold uppercase">BILL TO</span>
                      <span className="font-black">:{invoice.clientName}</span>
                      <span className="font-bold uppercase">ADDRESS</span>
                      <span className="font-bold uppercase leading-tight line-clamp-1">:{invoice.clientAddress}</span>
                      <span className="font-bold uppercase">MOBILE</span>
                      <span className="font-black">:{invoice.clientPhone || '-'}</span>
                    </div>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <div className="grid grid-cols-[80px,1fr] gap-x-1">
                      <span className="font-bold uppercase">STATE & CODE</span>
                      <span className="font-black uppercase">{invoice.clientState} : {invoice.clientStateCode}</span>
                      <span className="font-bold uppercase">GST</span>
                      <span className="font-black uppercase">:{invoice.clientGstin || '-'}</span>
                      <span className="font-bold uppercase">SMAN</span>
                      <span className="font-black">:{invoice.salesmanName || 'karthi'}</span>
                    </div>
                  </div>
                </div>

                {/* Table with Detailed GST Breakdown */}
                <div className="border-b-2 border-black flex-1 min-h-[150px]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-white text-[7px] font-black uppercase divide-x-2 divide-black border-b-2 border-black text-center">
                        <th className="w-8 py-1">SI.NO</th>
                        <th className="text-left px-2 py-1">PARTICULARS</th>
                        <th className="w-14 py-1">HSN CODE</th>
                        <th className="w-12 py-1">QTY</th>
                        <th className="w-14 py-1">RATE</th>
                        <th className="w-10 py-1">CGST</th>
                        <th className="w-14 py-1">CGST (amt)</th>
                        <th className="w-10 py-1">SGST</th>
                        <th className="w-14 py-1">SGST (amt)</th>
                        <th className="w-18 py-1">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className="divide-x-2 divide-black text-[8px] font-bold align-top h-6 uppercase">
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
                      {/* Remove empty items to increase print area for real content as per user request */}
                      {invoice.items.length < 3 && Array.from({ length: 3 - invoice.items.length }).map((_, i) => (
                        <tr key={`empty-${i}`} className="divide-x-2 divide-black h-6">
                          {Array.from({ length: 10 }).map((__, j) => <td key={j}></td>)}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-black font-black bg-white uppercase text-[8px]">
                      <tr className="divide-x-2 divide-black h-5">
                        <td colSpan={5}></td>
                        <td className="text-right px-1 font-mono" colSpan={2}>{invoice.subtotal.toFixed(2)}</td>
                        <td className="text-right px-1 font-mono" colSpan={2}>{(invoice.totalCgst + invoice.totalSgst + (invoice.totalIgst || 0)).toFixed(2)}</td>
                        <td className="text-right px-2 font-black">{invoice.totalAmount.toFixed(2)}</td>
                      </tr>
                      {/* Totals row breakdown matches the image row above footer */}
                      <tr className="divide-x-2 divide-black h-5 border-t-2 border-black text-center">
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
                <div className="border-b-2 border-black p-1 px-4 flex gap-2 items-center">
                  <span className="font-bold italic uppercase text-[8px]">Amount In Words:</span>
                  <span className="font-black uppercase text-[8px]">Rupees {amountToWords(invoice.totalAmount, invoice.currency)} Only</span>
                </div>

                {/* Boxed Footer with Bank Details */}
                <div className="p-1 px-2 flex justify-between items-center text-[8px] font-bold uppercase divide-x-2 divide-black -mx-px">
                  <div className="flex-1 flex gap-2 overflow-hidden text-[7px]">
                    <span className="truncate">Ac No:{settings.accountNumber}</span>
                    <span className="truncate">Ifsc:{settings.ifscCode}</span>
                    <span className="truncate">{settings.bankName}</span>
                  </div>
                  <div className="px-4 font-black">For {settings.companyName.toUpperCase()}</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col text-[11px] text-black bg-white border-[3px] border-black m-0 md:m-2 min-h-full">
                 {/* Standard Header */}
                 <div className={style.header}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-6">
                      {settings.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
                      ) : (
                        <Logo className="h-16 w-16" />
                      )}
                      <div className="text-xs opacity-80 max-w-sm leading-relaxed font-medium text-left">
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

                 <div className="p-8 md:p-16 flex-1 flex flex-col gap-8 md:gap-12 text-left">
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
                        <div className={cn("p-4 md:p-5 rounded-2xl border w-full space-y-3", style.border, "bg-white text-left")}>
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
                  <div className="text-[8px] text-[#94a3b8] uppercase font-bold tracking-[0.2em] flex flex-col gap-1 items-start">
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
            size: ${paperSize};
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
