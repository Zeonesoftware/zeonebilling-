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
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import QRCode from 'qrcode';
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
  const [paperSize, setPaperSize] = useState<'A4' | 'A5'>('A4');

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
                size: ${currentStyle === 'Thermal' ? '58mm auto' : (selectedPaperSize === 'A5' ? 'A5 landscape' : selectedPaperSize)}; 
                margin: 0 !important; 
              }
              body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              #invoice-print-area { 
                width: ${selectedPaperSize === 'A5' ? '210mm' : '210mm'} !important;
                height: ${selectedPaperSize === 'A5' ? '148mm' : '297mm'} !important;
                max-height: ${selectedPaperSize === 'A5' ? '148mm' : '297mm'} !important;
                box-shadow: none !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                position: relative !important;
                overflow: hidden !important;
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
      toast.loading('Generating PDF...', { id: 'pdf-gen' });
      
      const { toPng } = await import('html-to-image');
      const { default: jsPDF } = await import('jspdf');

      // Add a small delay to ensure loading states/UI settles
      await new Promise(resolve => setTimeout(resolve, 100));

      const originalWidth = element.style.width;
      const originalHeight = element.style.height;
      const originalTransform = element.style.transform;
      
      // Temporarily set dimensions for a perfect capture based on paper size
      element.style.width = paperSize === 'A5' ? '210mm' : '210mm';
      element.style.minHeight = paperSize === 'A5' ? '148mm' : '297mm';
      element.style.transform = 'none';

      // Hide elements not meant for print
      const noPrintElements = element.querySelectorAll('.no-print');
      noPrintElements.forEach(el => (el as HTMLElement).style.display = 'none');

      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          transform: 'none',
          boxShadow: 'none'
        }
      });

      // Restore elements
      noPrintElements.forEach(el => (el as HTMLElement).style.display = '');
      element.style.width = originalWidth;
      element.style.minHeight = originalHeight;
      element.style.transform = originalTransform;

      const pdf = new jsPDF({
        orientation: paperSize === 'A5' ? 'landscape' : 'portrait',
        unit: 'mm',
        format: paperSize === 'A5' ? 'a5' : 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const idealHeight = paperSize === 'A5' ? 148 : 297;
      const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;

      if (pdfHeight > idealHeight && (pdfHeight - idealHeight > 20)) {
        const extendPdf = new jsPDF({
          orientation: paperSize === 'A5' ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [pdfWidth, Math.max(idealHeight, pdfHeight + 10)]
        });
        extendPdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
        extendPdf.save(`Invoice-${invoice.invoiceNumber}.pdf`);
      } else {
        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, Math.min(idealHeight, pdfHeight));
        pdf.save(`Invoice-${invoice.invoiceNumber}.pdf`);
      }
      
      toast.success('Professional PDF Downloaded', { id: 'pdf-gen' });
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF.', { id: 'pdf-gen' });
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
                if (v === 'Simple') setPaperSize('A4');
                else if (v !== 'Thermal') setPaperSize('A4');
              }}
            >
              <SelectTrigger className="w-40 h-9 font-bold flex-shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Professional">Professional</SelectItem>
                <SelectItem value="Modern">Modern</SelectItem>
                <SelectItem value="Simple">Simple</SelectItem>
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
            
            {invoice.id !== 'draft' && invoice.status !== 'Draft' && !invoice.ewayBillNo && invoice.totalAmount >= 100000 && (
              <Button 
                onClick={() => setIsEWayBillModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-full px-6 flex-shrink-0 shadow-lg shadow-blue-100"
              >
                <Truck className="w-4 h-4" /> Generate E-Way Bill
              </Button>
            )}

            {invoice.ewayBillNo && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full flex-shrink-0">
                <Badge className="bg-blue-600 text-white font-black uppercase text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1.5 ring-2 ring-blue-100">
                  <Truck className="w-3 h-3" /> EWB: {invoice.ewayBillNo}
                </Badge>
                <span className="text-[10px] font-black uppercase text-blue-700 opacity-60">
                  {invoice.ewayBillStatus || 'Generated'}
                </span>
              </div>
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
                  "bg-white shadow-2xl w-full flex flex-col transition-all duration-500 overflow-hidden",
                  paperSize === 'A4' ? "md:w-[210mm] h-[297mm]" : "md:w-[210mm] h-[148mm]",
                  style.font
                )}
              >
            {currentStyle === 'Standard' ? (
              <div className="flex flex-col text-[10px] text-black bg-white m-0 md:m-1 h-full font-sans leading-tight">
                {/* Header Section */}
                <div className="p-6 md:p-8 flex justify-between items-start">
                  <div className="flex-1 space-y-1.5">
                    <h1 className="text-4xl font-bold text-[#003366] tracking-tighter uppercase leading-none">
                      {settings.companyName}
                    </h1>
                    <div className="text-[11px] font-medium uppercase text-black max-w-sm leading-relaxed">
                      {settings.address}
                    </div>
                    <div className="pt-2 space-y-0.5 text-[11px]">
                      <div className="font-bold">GSTIN : <span className="font-black">{settings.gstin}</span></div>
                      <div className="font-bold">MOBILE : <span className="font-black">{settings.phone}</span></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="h-24 w-auto object-contain" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <Logo className="h-16 w-16 text-[#003366]" />
                        <span className="text-[14px] font-black text-[#003366] mt-1 tracking-widest">TRADERS</span>
                      </div>
                    )}
                    {(invoice.irn || invoice.ackNo) && (
                      <div className="flex items-start gap-4 border border-black p-2 bg-white w-full max-w-[320px]">
                        {invoice.signedQrCode ? (
                          <div className="bg-white p-0.5 shrink-0 shadow-sm border border-black/5">
                            <QRCodeSVG value={invoice.signedQrCode} size={72} level="M" includeMargin={false} />
                          </div>
                        ) : (
                          <div className="w-[72px] h-[72px] bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-[7px] font-black uppercase text-slate-400 text-center px-1 shrink-0">QR CODE</div>
                        )}
                        <div className="flex flex-col gap-1 overflow-hidden">
                           <div className="text-[#003366] font-black text-[10px] leading-none tracking-tighter uppercase border-b border-black pb-1">E-INVOICE VALIDATED</div>
                           <div className="flex flex-col mt-0.5">
                              <span className="text-[7px] font-black uppercase text-slate-500 leading-none">IRN / ACK NO</span>
                              <span className="text-[8px] font-mono font-black border-l-2 border-black pl-2 py-0.5 mt-1 leading-tight break-all uppercase text-black">
                                {invoice.irn || invoice.ackNo || 'PENDING'}
                              </span>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="mx-4 border border-black overflow-hidden flex flex-col mb-4">
                  {/* FSSAI Bar */}
                  <div className="border-b border-black flex divide-x divide-black font-bold uppercase text-[9px] h-7 items-center bg-white">
                    <div className="flex-1 px-3">FSSAI : {settings.fssai || '22422260001585'}</div>
                    <div className="flex-[1.5] px-3 text-center text-[11px] font-black tracking-[0.2em]">TAX INVOICE</div>
                    <div className="flex-1 px-3 text-right">ORIGINAL FOR RECIPIENT</div>
                  </div>

                  {/* Customer & Invoice Info Grid */}
                  <div className="grid grid-cols-2 divide-x divide-black border-b border-black">
                    {/* Left: Customer Detail */}
                    <div className="flex flex-col">
                      <div className="border-b border-black py-1 text-center font-bold uppercase text-[11px] bg-white">Customer Detail</div>
                      <div className="p-3 grid grid-cols-[80px,1fr] gap-x-2 gap-y-1.5 text-[10px] font-bold">
                        <span className="opacity-70">M/S</span> <span className="font-black uppercase">{invoice.clientName}</span>
                        <span className="opacity-70">Address</span> <span className="font-black uppercase leading-tight">{invoice.clientAddress}</span>
                        <span className="opacity-70">Mobile</span> <span className="font-black">{invoice.clientPhone || '-'}</span>
                        <span className="opacity-70">GSTIN</span> <span className="font-black uppercase">{invoice.clientGstin || '-'}</span>
                        <div className="flex flex-col leading-none opacity-70">
                          <span>Place of</span>
                          <span>Supply</span>
                        </div>
                        <span className="font-black uppercase self-center">{invoice.clientState}</span>
                      </div>
                    </div>
                    {/* Right: Invoice Information */}
                    <div className="flex flex-col h-full">
                       <div className="grid grid-cols-[90px,1fr,70px,1fr] grow divide-x divide-black">
                         <div className="border-b border-black px-2 py-1 flex items-center font-bold">Invoice No.</div>
                         <div className="border-b border-black px-2 py-1 flex items-center font-black">{invoice.invoiceNumber}</div>
                         <div className="border-b border-black px-2 py-1 flex flex-col justify-center items-center font-bold leading-none text-center">
                            <span>Invoice</span>
                            <span>Date</span>
                         </div>
                         <div className="border-b border-black px-2 py-1 flex items-center font-black">{format(new Date(invoice.date), 'd/L/yyyy')}</div>

                         <div className="border-b border-black px-2 py-1 flex items-center font-bold">Challan No</div>
                         <div className="border-b border-black px-2 py-1 flex items-center font-black">{invoice.challanNo || '-'}</div>
                         <div className="border-b border-black px-2 py-1 flex flex-col justify-center items-center font-bold leading-none text-center">
                           <span>Challan</span>
                           <span>Date</span>
                         </div>
                         <div className="border-b border-black px-2 py-1 flex items-center font-black">-</div>

                         <div className="border-b border-black px-2 py-1 flex flex-col justify-center font-bold leading-none">
                           <span>E-Way Bill</span>
                           <span>No.</span>
                         </div>
                         <div className="border-b border-black px-2 py-1 flex items-center font-black col-span-3">{invoice.ewayBillNo || '-'}</div>

                         <div className="border-b border-black px-2 py-1 flex items-center font-bold">Transport</div>
                         <div className="border-b border-black px-2 py-1 flex items-center font-black uppercase text-[9px]">{invoice.transporterName || '-'}</div>

                         <div className="px-2 py-1 flex flex-col justify-center font-bold leading-none">
                           <span>Transport</span>
                           <span>ID</span>
                         </div>
                         <div className="px-2 py-1 flex items-center font-black">-</div>
                       </div>
                    </div>
                  </div>

                  {/* Items Table with Nested Headers */}
                  <div className="bg-white">
                    <table className="w-full border-collapse table-fixed text-[9px] font-bold">
                      <thead>
                        <tr className="border-b border-black text-center h-8 leading-[0.9]">
                          <th className="w-[4%] border-r border-black p-0.5">Sr.<br/>No.</th>
                          <th className="w-[18%] border-r border-black p-0.5">Name of Product / Service</th>
                          <th className="w-[10%] border-r border-black p-0.5">HSN / SAC</th>
                          <th className="w-[6%] border-r border-black p-0.5">Qty</th>
                          <th className="w-[10%] border-r border-black p-0.5">Rate</th>
                          <th className="w-[12%] border-r border-black p-0.5">Taxable Value</th>
                          <th className="w-[15%] border-r border-black p-0">
                             <div className="border-b border-black py-0.5">CGST</div>
                             <div className="grid grid-cols-2 divide-x divide-black h-full">
                               <div className="py-0.5">%</div>
                               <div className="py-0.5">Amount</div>
                             </div>
                          </th>
                          <th className="w-[15%] border-r border-black p-0">
                             <div className="border-b border-black py-0.5">SGST</div>
                             <div className="grid grid-cols-2 divide-x divide-black h-full">
                               <div className="py-0.5">%</div>
                               <div className="py-0.5">Amount</div>
                             </div>
                          </th>
                          <th className="w-[10%] p-0.5">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/10">
                        {invoice.items.map((item, idx) => (
                          <tr key={idx} className="h-10 text-center uppercase tracking-tight">
                            <td className="border-r border-black px-1 py-2">{idx + 1}</td>
                            <td className="border-r border-black px-2 py-2 text-left font-black leading-tight text-[9px]">
                              {item.name}
                            </td>
                            <td className="border-r border-black px-1 py-2">{item.hsn}</td>
                            <td className="border-r border-black px-1 py-2">{item.quantity}</td>
                            <td className="border-r border-black px-2 py-2 text-right font-mono">₹{item.price.toFixed(2)}</td>
                            <td className="border-r border-black px-2 py-2 text-right font-mono">₹{(item.quantity * item.price).toFixed(2)}</td>
                            <td className="border-r border-black p-0 h-full">
                               <div className="grid grid-cols-2 divide-x divide-black h-full">
                                 <div className="flex items-center justify-center">{(item.gstRate / 2).toFixed(1)}</div>
                                 <div className="flex items-center justify-end px-1 font-mono">₹{(item.cgst || 0).toFixed(2)}</div>
                               </div>
                            </td>
                            <td className="border-r border-black p-0 h-full">
                               <div className="grid grid-cols-2 divide-x divide-black h-full">
                                 <div className="flex items-center justify-center">{(item.gstRate / 2).toFixed(1)}</div>
                                 <div className="flex items-center justify-end px-1 font-mono">₹{(item.sgst || 0).toFixed(2)}</div>
                               </div>
                            </td>
                            <td className="px-2 py-2 text-right font-black font-mono">₹{item.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Summary Table Row */}
                      <tfoot>
                        <tr className="border-t border-black bg-white font-black text-[10px] h-8 divide-x divide-black">
                           <td colSpan={3} className="text-right px-3 uppercase tracking-widest">Total</td>
                           <td className="text-center">{invoice.items.reduce((acc, i) => acc + i.quantity, 0)} NOS</td>
                           <td className="bg-white"></td>
                           <td className="text-right px-2 font-mono">₹{invoice.subtotal.toFixed(2)}</td>
                           <td className="p-0">
                              <div className="grid grid-cols-2 divide-x divide-black h-full">
                                <div className="bg-white"></div>
                                <div className="flex items-center justify-end px-1 font-mono">₹{(invoice.totalCgst || (invoice.totalIgst / 2) || 0).toFixed(2)}</div>
                              </div>
                           </td>
                           <td className="p-0">
                              <div className="grid grid-cols-2 divide-x divide-black h-full">
                                <div className="bg-white"></div>
                                <div className="flex items-center justify-end px-1 font-mono">₹{(invoice.totalSgst || (invoice.totalIgst / 2) || 0).toFixed(2)}</div>
                              </div>
                           </td>
                           <td className="text-right px-2 font-mono">₹{invoice.totalAmount.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Summary & Footer Grid */}
                  <div className="grid grid-cols-12 divide-x divide-black border-t border-black h-full bg-white">
                    <div className="col-span-7 flex flex-col divide-y divide-black bg-white">
                      {/* Total words section */}
                      <div className="flex flex-col">
                        <div className="border-b border-black py-1 px-3 font-bold uppercase text-[10px] text-center bg-white">Total in words</div>
                        <div className="p-4 flex-1 flex items-center justify-center min-h-[60px]">
                          <div className="text-[11px] font-black uppercase text-center italic tracking-tight">
                            {amountToWords(invoice.totalAmount, invoice.currency)} ONLY
                          </div>
                        </div>
                      </div>
                      {/* Bank Details section */}
                      <div className="flex flex-col">
                        <div className="border-b border-black py-1 px-3 font-bold uppercase text-[10px] text-center bg-white">Bank Details</div>
                        <div className="p-4 flex gap-6 items-center">
                           <div className="flex-1 space-y-1 font-bold text-[10px]">
                              <div className="flex justify-between items-center"><span className="opacity-60 uppercase text-[9px]">Name</span> <span className="uppercase font-black">{settings.bankName || 'UJJIVAN BANK'}</span></div>
                              <div className="flex justify-between items-center"><span className="opacity-60 uppercase text-[9px]">Acc. Number</span> <span className="font-mono font-black">{settings.accountNumber}</span></div>
                              <div className="flex justify-between items-center"><span className="opacity-60 uppercase text-[9px]">IFSC</span> <span className="uppercase font-black">{settings.ifscCode}</span></div>
                              <div className="flex justify-between items-center"><span className="opacity-60 uppercase text-[9px]">UPI ID</span> <span className="font-black">{settings.upiId || '8667586727-2@axl'}</span></div>
                           </div>
                           <div className="flex flex-col items-center shrink-0">
                              <QRCodeSVG value={`upi://pay?pa=${settings.upiId || '8667586727-2@axl'}&pn=${settings.companyName}&am=${invoice.totalAmount}&cu=INR`} size={64} level="M" />
                              <span className="text-[8px] font-bold uppercase mt-1 opacity-60">Pay using UPI</span>
                           </div>
                        </div>
                      </div>
                    </div>
                    {/* Summary Calculation Sidebar */}
                    <div className="col-span-5 flex flex-col divide-y divide-black bg-white">
                      <div className="grow">
                        <table className="w-full border-collapse text-[10px] font-bold bg-white">
                          <tbody>
                            <tr className="border-b border-black h-8 divide-x divide-black">
                              <td className="px-3">Taxable Amount</td>
                              <td className="px-3 text-right font-mono font-black">₹{invoice.subtotal.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b border-black h-8 divide-x divide-black">
                              <td className="px-3">Add : CGST</td>
                              <td className="px-3 text-right font-mono font-black">₹{(invoice.totalCgst || (invoice.totalIgst / 2) || 0).toFixed(2)}</td>
                            </tr>
                            <tr className="border-b border-black h-8 divide-x divide-black">
                              <td className="px-3">Add : SGST</td>
                              <td className="px-3 text-right font-mono font-black">₹{(invoice.totalSgst || (invoice.totalIgst / 2) || 0).toFixed(2)}</td>
                            </tr>
                            <tr className="border-b border-black h-8 divide-x divide-black bg-slate-50">
                              <td className="px-3">Total Tax</td>
                              <td className="px-3 text-right font-mono font-black">₹{((invoice.totalCgst || 0) + (invoice.totalSgst || 0)).toFixed(2)}</td>
                            </tr>
                            <tr className="h-8 divide-x divide-black bg-slate-100">
                              <td className="px-3 text-[11px]">Total Amount After Tax</td>
                              <td className="px-3 text-right font-mono font-black text-xs md:text-sm">₹{invoice.totalAmount.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {/* Signatory Area */}
                      <div className="p-4 flex flex-col h-[150px]">
                         <div className="text-[9px] italic opacity-70 text-center mb-1 leading-tight">Certified that the particulars given above are true and correct.</div>
                         <div className="text-center font-black uppercase text-[11px] mb-auto">For {settings.companyName.toUpperCase()}</div>
                         
                         <div className="relative flex flex-col items-center">
                            {settings.signatureUrl && (
                              <img src={settings.signatureUrl} alt="Signature" className="h-16 w-auto mix-blend-multiply brightness-50 absolute -top-12 z-10" />
                            )}
                            <div className="text-[9px] font-black border-t border-black pt-1 w-full text-center uppercase tracking-widest">Authorised Signatory</div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Final Thank You phrase */}
                <div className="mx-4 text-center text-[11px] font-bold text-gray-500 uppercase italic tracking-[0.1em] mb-4">
                   Thank you for shopping with us!
                </div>
              </div>
            ) : currentStyle === 'Modern' ? (
              <div 
                className="flex flex-col h-full bg-white box-border shrink-0 text-[10px] text-black font-sans"
                style={{ padding: paperSize === 'A5' ? "4mm 4mm" : "10mm 10mm" }}
              >
                <div className="flex flex-col flex-1 border border-black relative overflow-hidden bg-white">
                  {/* Modern / Industrial Header */}
                  <div className="p-4 flex justify-between items-start gap-4 text-left border-b border-black/10">
                  <div className="flex-1 space-y-2">
                    <div className="text-3xl font-black tracking-tighter text-black leading-none uppercase">
                      {settings.companyName}
                    </div>
                    <div className="flex flex-col gap-0.5 text-xs font-bold text-black pt-1">
                       <div className="max-w-[400px] leading-relaxed italic uppercase font-medium text-[10px]">{settings.address}</div>
                       <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 border-t border-black/10 pt-1 text-[10px]">
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
                      <div className="flex items-start gap-4 border border-black p-3 bg-white w-[260px] rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
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
                              <span className="text-[9px] font-mono font-bold leading-tight break-all uppercase text-slate-900 border-l border-black pl-2 leading-none py-1">
                                {invoice.irn || invoice.ackNo}
                              </span>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* PAN / GST Bar */}
                <div className="border-y border-black bg-slate-50 flex items-center justify-between px-4 py-2 font-black text-xs uppercase tracking-wider text-black">
                  <div>PAN : <span className="font-mono">{settings.pan || '-'}</span></div>
                  <div className="flex flex-col items-center">
                    <div className="text-lg tracking-tighter font-black underline underline-offset-4">{invoice.type?.toUpperCase()}</div>
                  </div>
                  <div>ORIGINAL FOR RECIPIENT</div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 border-b border-black divide-x divide-black text-black">
                  <div className="p-3 space-y-1.5 text-left">
                    <div className="bg-slate-100 -mx-3 -mt-3 mb-1.5 py-1 px-4 border-b border-black text-center font-black text-[9px] uppercase tracking-widest text-black">Customer Details</div>
                    <div className="grid grid-cols-[80px,1fr] gap-x-2 gap-y-0.5 mt-1">
                      <div className="font-bold opacity-70 uppercase text-[8px]">M/S</div>
                      <div className="font-black text-xs uppercase">{invoice.clientName}</div>
                      <div className="font-bold opacity-70 uppercase text-[8px]">Address</div>
                      <div className="leading-snug font-bold uppercase text-[9px]">{invoice.clientAddress}</div>
                      <div className="font-bold opacity-70 uppercase text-[8px]">GSTIN / Mobile</div>
                      <div className="font-mono font-black text-[9px]">{invoice.clientGstin} / {invoice.clientPhone || '-'}</div>
                    </div>
                  </div>
                  <div className="p-3 space-y-1.5 text-left">
                    <div className="bg-slate-100 -mx-3 -mt-3 mb-1.5 py-1 px-4 border-b border-black text-center font-black text-[9px] uppercase tracking-widest text-black">Invoice Information</div>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                       <div className="space-y-1.5">
                          <div className="flex flex-col gap-0 text-[9px]">
                            <span className="opacity-50 font-black uppercase text-[7px]">Invoice No.</span>
                            <span className="font-black font-mono text-[10px]">{invoice.invoiceNumber}</span>
                          </div>
                          <div className="flex flex-col gap-0 text-[9px]">
                            <span className="opacity-50 font-black uppercase text-[7px]">Challan No</span>
                            <span className="font-bold text-[9px]">{invoice.challanNo || '-'}</span>
                          </div>
                       </div>
                       <div className="space-y-1.5">
                          <div className="flex flex-col gap-0 text-[9px]">
                            <span className="opacity-50 font-black uppercase text-[7px]">Date</span>
                            <span className="font-bold font-mono text-[10px]">{format(new Date(invoice.date), 'dd/MM/yyyy')}</span>
                          </div>
                          <div className="flex flex-col gap-0 text-[9px]">
                            <span className="opacity-50 font-black uppercase text-[7px]">Transport</span>
                            <span className="font-bold uppercase leading-tight text-[8px]">{invoice.transporterName || '-'}</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="flex-1 flex flex-col border-b border-slate-300 bg-white">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold uppercase tracking-widest text-slate-600 divide-x divide-slate-300 border-b border-slate-300">
                        <th className="py-2 px-2 text-center w-10">Sr. No.</th>
                        <th className="py-2 px-4 text-left min-w-[120px]">Name of Product / Service</th>
                        <th className="py-2 px-2 text-center w-16">HSN / SAC</th>
                        <th className="py-2 px-2 text-center w-12">Qty</th>
                        <th className="py-2 px-2 text-right w-20">Rate</th>
                        <th className="py-2 px-2 text-right w-24">Taxable Value</th>
                        <th className="py-2 px-2 text-center border-b border-slate-300" colSpan={2}>CGST / SGST</th>
                        <th className="py-2 px-2 text-right w-36 whitespace-nowrap">Total Amount</th>
                      </tr>
                      <tr className="bg-slate-50 text-[8px] font-bold uppercase text-slate-500 divide-x divide-slate-300 border-b border-slate-300">
                        <th colSpan={6}></th>
                        <th className="py-1 px-1 text-center w-8">%</th>
                        <th className="py-1 px-1 text-right min-w-[50px]">Amount</th>
                        <th className="py-1 px-3 text-right whitespace-nowrap">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className="divide-x divide-slate-300 text-[10px] align-top">
                          <td className="py-2 px-2 text-center">{idx + 1}</td>
                          <td className="py-2 px-4">
                            <div className="font-bold">{item.name}</div>
                          </td>
                          <td className="py-2 px-2 text-center font-mono">{item.hsn}</td>
                          <td className="py-2 px-2 text-center font-bold">{item.quantity} {item.unit || 'NOS'}</td>
                          <td className="py-2 px-2 text-right font-mono">{formatCurrency(item.price, invoice.currency)}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold">{formatCurrency((item.quantity * item.price), invoice.currency)}</td>
                          <td className="py-2 px-2 text-center font-mono">{item.gstRate / 2}%</td>
                          <td className="py-2 px-2 text-right font-mono italic text-[9px]">
                              <div className="space-y-0">
                                <div>C: {formatCurrency(item.cgst || (item.igst / 2) || 0, invoice.currency)}</div>
                                <div>S: {formatCurrency(item.sgst || (item.igst / 2) || 0, invoice.currency)}</div>
                              </div>
                          </td>
                          <td className="py-2 px-3 text-right font-bold font-mono text-[11px] whitespace-nowrap">{formatCurrency(item.total, invoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-300 font-bold bg-slate-50">
                       <tr className="divide-x divide-slate-300 text-[10px]">
                          <td colSpan={2} className="py-2 px-4 text-right uppercase tracking-widest text-[#008080]">Total</td>
                          <td className="w-16"></td>
                          <td className="w-12 text-center">{invoice.items.reduce((acc, item) => acc + item.quantity, 0)} NOS</td>
                          <td className="w-20"></td>
                          <td className="w-24 text-right font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
                          <td className="w-8"></td>
                          <td className="min-w-[50px] text-right font-mono">{formatCurrency(invoice.totalIgst + invoice.totalCgst + invoice.totalSgst, invoice.currency)}</td>
                          <td className="w-36 text-right font-mono whitespace-nowrap">{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
                       </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Summary Section */}
                <div className="grid grid-cols-12 divide-x divide-slate-300 border-b border-slate-300">
                   <div className="col-span-8 p-3">
                      <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total in words</div>
                      <div className="text-[10px] font-black uppercase tracking-tight text-slate-700 italic">
                        {amountToWords(invoice.totalAmount, invoice.currency)} ONLY
                      </div>
                   </div>
                   <div className="col-span-4 p-2.5 space-y-1 font-bold text-[9px]">
                      <div className="flex justify-between items-center text-slate-500">
                        <span className="uppercase tracking-tight text-[8px]">Taxable Amount</span>
                        <span className="font-mono text-slate-900">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-slate-500">
                        <span className="uppercase tracking-tight text-[8px]">Add: CGST</span>
                        <span className="font-mono text-slate-800">{formatCurrency(invoice.totalCgst || (invoice.totalIgst / 2) || 0, invoice.currency)}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span className="uppercase tracking-tight text-[8px]">Add: SGST</span>
                        <span className="font-mono text-slate-800">{formatCurrency(invoice.totalSgst || (invoice.totalIgst / 2) || 0, invoice.currency)}</span>
                      </div>

                      <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-200">
                         <span className="uppercase tracking-widest text-[#008080] text-[8px]">Total Tax</span>
                         <span className="font-mono font-black text-slate-900">{formatCurrency((invoice.totalIgst || 0) + (invoice.totalCgst || 0) + (invoice.totalSgst || 0), invoice.currency)}</span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-12 divide-x divide-slate-300 border-b border-slate-300">
                    <div className="col-span-8 flex flex-col divide-y divide-slate-200">
                       <div className="bg-slate-50/50 py-1 px-4 border-b border-slate-300 text-left font-bold text-[9px] uppercase tracking-widest text-slate-600">Bank Details & Payment</div>
                       <div className="p-3 px-4 flex gap-6 items-center">
                         <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[9px] flex-1">
                           <div className="flex justify-between border-b border-slate-100 pb-0.5">
                             <span className="font-bold opacity-60 uppercase text-[7px]">Bank Name</span>
                             <span className="font-black text-slate-900">{settings.bankName}</span>
                           </div>
                           <div className="flex justify-between border-b border-slate-100 pb-0.5">
                             <span className="font-bold opacity-60 uppercase text-[7px]">A/C Number</span>
                             <span className="font-mono font-black text-slate-900">{settings.accountNumber}</span>
                           </div>
                           <div className="flex justify-between border-b border-slate-100 pb-0.5">
                             <span className="font-bold opacity-60 uppercase text-[7px]">IFSC Code</span>
                             <span className="font-mono font-black text-slate-900">{settings.ifscCode}</span>
                           </div>
                           <div className="flex justify-between border-b border-slate-100 pb-0.5">
                             <span className="font-bold opacity-60 uppercase text-[7px]">Branch</span>
                             <span className="font-bold text-slate-900">{settings.bankBranch || '-'}</span>
                           </div>
                           <div className="flex justify-between pt-0.5 col-span-2">
                             <span className="font-bold opacity-60 uppercase text-[7px]">UPI ID</span>
                             <span className="font-mono font-black text-[#008080]">{settings.upiId || '-'}</span>
                           </div>
                         </div>
                         
                         {settings.upiId && (
                           <div className="flex flex-col items-center gap-1 shrink-0 p-1 border border-slate-200 bg-white rounded-sm shadow-sm relative group">
                              <QRCodeCanvas value={`upi://pay?pa=${settings.upiId}&pn=${settings.companyName}&am=${invoice.totalAmount}&cu=INR`} size={65} level="M" />
                              <div className="text-[7px] font-black uppercase text-slate-400">Scan to Pay</div>
                           </div>
                         )}
                       </div>
                    </div>
                   <div className="col-span-4 flex flex-col divide-y divide-slate-300">
                      <div className="flex justify-between p-3 border-b border-slate-300 font-black text-xs md:text-sm bg-slate-900 text-white">
                        <span>Total Amount</span>
                        <span className="text-[#4ade80]">{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
                      </div>
                      <div className="flex-1 p-3 bg-white flex flex-col justify-between">
                         <div className="space-y-1">
                           <div className="text-[8px] font-bold uppercase tracking-widest text-[#008080]">Terms & Conditions</div>
                           <div className="text-[8px] text-slate-600 italic leading-tight whitespace-pre-wrap">
                             {settings.terms}
                           </div>
                         </div>
                         
                         <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center relative">
                            {settings.signatureUrl ? (
                              <>
                                <img src={settings.signatureUrl} alt="Signature" className="h-12 w-auto mix-blend-multiply opacity-80" />
                                <div className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-60">Authorised Signatory</div>
                              </>
                            ) : (
                              <div className="text-[8px] text-slate-300 italic text-center w-full uppercase">Computer Generated Document</div>
                            )}
                         </div>
                      </div>
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
              </div>
            ) : currentStyle === 'Simple' ? (
              <div 
                className={cn(
                  "flex flex-col text-black bg-white shrink-0 box-border",
                  paperSize === 'A4' ? "w-[210mm] min-h-[297mm]" : "w-[210mm] h-[147.5mm]"
                )}
                style={{ 
                  padding: paperSize === 'A5' ? "4mm 6mm" : "15mm 12mm", 
                  fontFamily: '"Times New Roman", Times, serif',
                  fontSize: paperSize === 'A5' ? '7.5pt' : '10pt'
                }}
              >
                <div className="flex flex-col h-full border-[1.5px] border-black p-[2mm] md:p-[5mm] box-border relative overflow-hidden">
                  {/* Image-style Header matching the attachment */}
                  <div className="border-b-[1.5px] border-black shrink-0 break-inside-avoid">
                  <div className={cn("border-b border-black flex justify-between items-start font-bold uppercase", paperSize === 'A5' ? "p-0.5 px-2 text-[6.5pt]" : "p-2 text-[10pt]")}>
                    <div className="space-y-0.5">
                      <div>GSTIN: {settings.gstin}</div>
                      {(settings.fssai || true) && (
                        <div>FASSAI NO: {settings.fssai || '22422260001585'}</div>
                      )}
                    </div>
                    <div className={cn("text-center font-black uppercase", paperSize === 'A5' ? "text-[8pt]" : "text-[11pt] mt-0.5")}>TAX INVOICE</div>
                    <div>MOBILE: {settings.phone || '+919629151289'}</div>
                  </div>
                  
                  <div className={cn("text-center space-y-0.5 px-4", paperSize === 'A5' ? "py-0.5" : "py-2")}>
                    <h1 className={cn("font-black uppercase tracking-tight leading-none", paperSize === 'A5' ? "text-lg" : "text-3xl")}>{settings.companyName || 'B.A.TRADERS'}</h1>
                    <div className={cn("font-bold uppercase leading-tight max-w-2xl mx-auto", paperSize === 'A5' ? "text-[6.5pt]" : "text-[10pt]")}>
                      {settings.address || '#7B,Gorimettu Street,Manaloorpettai Road, Tiruvannamalai-606601'}
                    </div>
                  </div>
                </div>

                {/* Sub-Header bar - Invoice No & Date */}
                <div className="border-b-[1.5px] border-black flex divide-x-[1.5px] divide-black font-bold uppercase shrink-0 break-inside-avoid">
                  <div className={cn("flex-1 px-3", paperSize === 'A5' ? "p-0.5 text-[7pt]" : "p-1.5 text-[10pt]")}>Invoice No: {invoice.invoiceNumber}</div>
                  <div className={cn("flex-1 px-3 text-right", paperSize === 'A5' ? "p-0.5 text-[7pt]" : "p-1.5 text-[10px]")}>DATE: {format(new Date(invoice.date), 'dd-MM-yyyy')}</div>
                </div>

                {/* Info Grid - Party Details matching the image exactly */}
                <div className="grid grid-cols-2 divide-x-[1.5px] divide-black border-b-[1.5px] border-black shrink-0 break-inside-avoid">
                  <div className={cn("space-y-0.5", paperSize === 'A5' ? "p-0.5 px-2" : "p-2")}>
                    <div className={cn("grid grid-cols-[60px,1fr] gap-x-1", paperSize === 'A5' ? "text-[7pt]" : "grid-cols-[80px,1fr]")}>
                      <span className="font-bold uppercase">BILL TO</span>
                      <span className="font-black">: {invoice.clientName}</span>
                      <span className="font-bold uppercase">ADDRESS</span>
                      <span className="font-black leading-tight uppercase">: {invoice.clientAddress}</span>
                      <div className={cn("col-span-2", paperSize === 'A5' ? "h-0.5" : "h-2")}></div>
                      <span className="font-bold uppercase">MOBILE</span>
                      <span className="font-black">: {invoice.clientPhone}</span>
                    </div>
                  </div>
                  <div className={cn("space-y-0.5", paperSize === 'A5' ? "p-0.5 px-2" : "p-2")}>
                    <div className={cn("grid grid-cols-[80px,1fr] gap-x-1", paperSize === 'A5' ? "text-[7pt]" : "grid-cols-[100px,1fr]")}>
                      <span className="font-bold uppercase">STATE CODE</span>
                      <span className="font-black uppercase">: {invoice.clientState} : {invoice.clientStateCode}</span>
                      <span className="font-bold uppercase">GST</span>
                      <span className="font-black uppercase">: {invoice.clientGstin || '-'}</span>
                      <div className={cn("col-span-2", paperSize === 'A5' ? "h-0.5" : "h-2")}></div>
                      <span className="font-bold uppercase">SMAN</span>
                      <span className="font-black uppercase">: {invoice.salesmanName || 'karthi'}</span>
                    </div>
                  </div>
                </div>

                {/* Detailed Table exactly like image layout */}
                <div className="flex-1 border-b-[1.5px] border-black bg-white flex flex-col min-h-0 overflow-hidden relative">
                  {/* Vertical Lines Background (Full Height) */}
                  <div className="absolute inset-0 pointer-events-none flex divide-x-[1.5px] divide-black h-full">
                    <div className="w-[6%]"></div>
                    <div className="flex-1"></div>
                    <div className="w-[12%]"></div>
                    <div className="w-[8%]"></div>
                    <div className="w-[12%]"></div>
                    <div className="w-[6%]"></div>
                    <div className="w-[10%]"></div>
                    <div className="w-[6%]"></div>
                    <div className="w-[10%]"></div>
                    <div className="w-[12%]"></div>
                  </div>

                  <table className="w-full border-collapse table-fixed relative z-10">
                    <thead className="sticky top-0 z-20">
                      <tr className={cn("font-black uppercase border-b-[1.5px] border-black text-center", paperSize === 'A5' ? "text-[6.5pt] h-6" : "text-[8pt] h-10")}>
                        <th className="w-[6%]">SI.NO</th>
                        <th className="text-left px-2 md:px-4 w-[18%]">PARTICULARS</th>
                        <th className="w-[12%]">HSN CODE</th>
                        <th className="w-[8%]">QTY</th>
                        <th className="w-[12%]">RATE</th>
                        <th className="w-[6%]">CGST</th>
                        <th className="w-[10%] px-0.5">CGST amt</th>
                        <th className="w-[6%]">SGST</th>
                        <th className="w-[10%] px-0.5">SGST amt</th>
                        <th className="w-[12%]">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-[1.5px] border-b-[1.5px] border-black divide-black/10">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className={cn("font-black align-middle h-auto uppercase", paperSize === 'A5' ? "text-[7.5pt]" : "text-[10pt]")}>
                          <td className="text-center py-1">{idx + 1}</td>
                          <td className="px-2 md:px-4 text-left py-1 font-black leading-tight">
                            <div>{item.name}</div>
                          </td>
                          <td className="text-center font-mono py-1">{item.hsn}</td>
                          <td className="text-center py-1">{item.quantity} {item.unit || 'BOX'}</td>
                          <td className="text-right px-1 md:px-2 font-mono py-1">{item.price.toFixed(2)}</td>
                          <td className="text-center py-1">{(item.gstRate / 2).toFixed(2)}%</td>
                          <td className="text-right px-1 md:px-2 font-mono py-1">{(item.cgst || 0).toFixed(2)}</td>
                          <td className="text-center py-1">{(item.gstRate / 2).toFixed(2)}%</td>
                          <td className="text-right px-1 md:px-2 font-mono py-1">{(item.sgst || 0).toFixed(2)}</td>
                          <td className="text-right px-1 md:px-2 font-black py-1">{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Space filler to push footer down */}
                  <div className="flex-1 bg-transparent"></div>
                  
                  {/* Footer Row exactly like the others */}
                  <div className={cn("border-t-[1.5px] border-black font-black uppercase flex shrink-0 relative z-10", paperSize === 'A5' ? "text-[7.5pt] h-8" : "text-[10pt] h-10")}>
                    <div className="w-[6%]"></div>
                    <div className="flex-1"></div>
                    <div className="w-[12%]"></div>
                    <div className="w-[8%]"></div>
                    <div className="w-[12%] text-right font-mono flex items-center justify-end px-1 md:px-2">{invoice.subtotal.toFixed(2)}</div>
                    <div className="w-[6%]"></div>
                    <div className="w-[10%] text-right font-mono flex items-center justify-end px-1 md:px-2">{(invoice.totalCgst || (invoice.totalIgst / 2) || 0).toFixed(2)}</div>
                    <div className="w-[6%]"></div>
                    <div className="w-[10%] text-right font-mono flex items-center justify-end px-1 md:px-2">{(invoice.totalSgst || (invoice.totalIgst / 2) || 0).toFixed(2)}</div>
                    <div className={cn("w-[12%] text-right font-black flex items-center justify-end px-1 md:px-2 bg-black/5 font-black", paperSize === 'A5' ? "text-[8pt]" : "text-xs")}>{invoice.totalAmount.toFixed(2)}</div>
                  </div>
                </div>

                {/* Amount in words Section matching image wording perfectly */}
                <div className={cn("border-b-[1.5px] border-black flex justify-center items-center shrink-0 break-inside-avoid", paperSize === 'A5' ? "py-0.5 px-2 text-[7pt]" : "p-3 px-8 text-[12px]")}>
                   <div className="flex gap-2 items-baseline w-full">
                      <span className="font-black uppercase whitespace-nowrap">Amount In Words:</span>
                      <span className="font-black uppercase tracking-tight text-center flex-1">Rupees {amountToWords(invoice.totalAmount, invoice.currency)} Only</span>
                   </div>
                </div>

                {/* signature-footer-box */}
                <div className={cn("px-3 flex justify-between items-center font-bold uppercase shrink-0 break-inside-avoid", paperSize === 'A5' ? "p-0.5 text-[7pt]" : "p-2 text-[10px]")}>
                  <div className={cn("flex divide-x-2 divide-black/20", paperSize === 'A5' ? "gap-1 text-[6.5pt]" : "gap-6")}>
                    <span className="font-black">Ac No:{settings.accountNumber}</span>
                    <span className={cn("font-black", paperSize === 'A5' ? "px-1" : "px-4")}>Ifsc:{settings.ifscCode}</span>
                    <span className={cn("font-black", paperSize === 'A5' ? "px-1" : "px-4")}>{settings.bankName}</span>
                  </div>
                  <div className={cn("font-black", paperSize === 'A5' ? "text-[7.5pt]" : "")}>For {settings.companyName.toUpperCase() || 'BA TRADERS'}</div>
                </div>
              </div>
            </div>
            ) : (
                <div 
                  className="flex flex-col bg-white text-black font-sans box-border h-full relative"
                  style={{ 
                    width: '210mm', 
                    height: '297mm',
                    padding: '8mm',
                    fontSize: '9pt',
                    lineHeight: '1.2'
                  }}
                >
                  <div className="flex flex-col h-full border border-black box-border relative">
                    
                    {/* Header Section */}
                    <div className="flex justify-between items-start border-b border-black p-4 relative min-h-[50mm]">
                      <div className="flex-1">
                        <h1 className="text-[28pt] font-black uppercase text-slate-800 leading-none mb-1 tracking-tighter">
                          {settings.companyName || 'GUJARAT FREIGHT TOOLS'}
                        </h1>
                        <div className="bg-[#008080] text-white px-4 py-1 text-[10.5pt] font-bold inline-block mb-4 mt-2">
                          {settings.tagline || 'Manufacturing & Supply of Precision Press Tool & Room Component'}
                        </div>
                        <div className="text-[9pt] leading-tight max-w-[550px]">
                          <p className="font-medium text-slate-700">{settings.address || 'Plot No A 64, Road No 21, Waghle Indl Estate, Mumbai, Maharashtra - 400604'}</p>
                          {settings.phone && <div className="mt-2 font-bold text-slate-800">Tel : {settings.phone}</div>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end text-right">
                        <div className="w-[50mm] mb-3 flex justify-end h-[25mm] items-center">
                           {settings.logoUrl ? (
                             <img src={settings.logoUrl} alt="Logo" className="max-h-full object-contain" referrerPolicy="no-referrer" />
                           ) : (
                             <div className="w-[40mm] h-[25mm] bg-teal-50 border-2 border-teal-600/20 flex flex-col items-center justify-center">
                                <span className="text-[8pt] font-black text-teal-600">LOGOTEXT</span>
                                <span className="text-[6pt] font-bold text-teal-800/40">SLOGAN HERE</span>
                             </div>
                           )}
                        </div>
                        <div className="text-[8.5pt] font-bold text-slate-600 space-y-0.5">
                          <div>Tel : {settings.phone || '02225820309'}</div>
                          <div>Web : {settings.email || 'info@gft.com'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Tax Invoice Status Bar */}
                    <div className="border-b border-black flex items-center justify-between px-4 h-[10mm] bg-white">
                      <div className="font-bold text-[10pt]">PAN : <span className="font-black uppercase tracking-wider">{settings.pan || '26CORPP3939N1'}</span></div>
                      <div className="text-[16pt] font-black uppercase tracking-[0.2em] text-slate-800">TAX INVOICE</div>
                      <div className="text-[8pt] font-bold uppercase opacity-80">ORIGINAL FOR RECIPIENT</div>
                    </div>

                    {/* Meta Details Section */}
                    <div className="grid grid-cols-2 border-b border-black min-h-[45mm]">
                      <div className="border-r border-black flex flex-col">
                        <div className="bg-slate-50 text-center font-bold border-b border-black py-1 text-[8pt] uppercase tracking-wider">Customer Detail</div>
                        <div className="p-3 grid grid-cols-[100px,1fr] gap-x-2 gap-y-2 text-[9pt]">
                          <span className="font-bold text-slate-600 uppercase text-[8pt]">M/S</span>
                          <span className="font-black text-slate-900 uppercase">{invoice.clientName}</span>
                          
                          <span className="font-bold text-slate-600 uppercase text-[8pt]">Address</span>
                          <span className="leading-snug text-[8.5pt] font-medium">{invoice.clientAddress}</span>
                          
                          <span className="font-bold text-slate-600 uppercase text-[8pt]">Phone</span>
                          <span className="font-bold text-slate-800">{invoice.clientPhone || '9878789878'}</span>
                          
                          <span className="font-bold text-slate-600 uppercase text-[8pt]">GSTIN</span>
                          <span className="font-black text-slate-900">{invoice.clientGstin || '32AABBA7890B1ZB'}</span>
                          
                          <span className="font-bold text-slate-600 uppercase text-[8pt]">Place of Supply</span>
                          <span className="font-bold text-slate-800">{invoice.clientState || 'Kerala ( 32 )'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <div className="grid grid-cols-2">
                           <div className="p-2 border-r border-b border-black flex flex-col justify-center h-[12mm]">
                             <span className="text-[7pt] font-bold text-slate-500 uppercase">Invoice No.</span>
                             <span className="font-black text-[10pt] uppercase tracking-tight">{invoice.invoiceNumber}</span>
                           </div>
                           <div className="p-2 border-b border-black flex flex-col justify-center h-[12mm]">
                             <span className="text-[7pt] font-bold text-slate-500 uppercase">Invoice Date</span>
                             <span className="font-black text-[10pt]">{format(new Date(invoice.date), 'dd-MMM-yyyy')}</span>
                           </div>
                           <div className="p-2 border-r border-b border-black flex flex-col justify-center h-[12mm]">
                             <span className="text-[7pt] font-bold text-slate-500 uppercase">Challan No</span>
                             <span className="font-black">{invoice.challanNo || '33'}</span>
                           </div>
                           <div className="p-2 border-b border-black flex flex-col justify-center h-[12mm]">
                             <span className="text-[7pt] font-bold text-slate-500 uppercase">Challan Date</span>
                             <span className="font-black">{invoice.challanDate ? format(new Date(invoice.challanDate), 'dd-MMM-yyyy') : format(new Date(invoice.date), 'dd-MMM-yyyy')}</span>
                           </div>
                           <div className="p-2 border-r border-b border-black flex flex-col justify-center h-[12mm]">
                             <span className="text-[7pt] font-bold text-slate-500 uppercase">E-Way Bill No.</span>
                             <span className="font-black underline decoration-dotted underline-offset-2">{invoice.ewayBillNo || '78456378'}</span>
                           </div>
                           <div className="p-2 border-b border-black flex flex-col justify-center h-[12mm]">
                             <span className="text-[7pt] font-bold text-slate-500 uppercase">Transport</span>
                             <span className="font-black uppercase text-[8pt]">{invoice.transporterName || 'Silver Roadlines'}</span>
                           </div>
                           <div className="col-span-2 p-2 flex flex-col justify-center h-[11mm]">
                             <span className="text-[7pt] font-bold text-slate-500 uppercase">Transport ID</span>
                             <span className="font-black text-[9pt]">{invoice.transporterId || '24ABSFS0321B2ZL'}</span>
                           </div>
                        </div>
                      </div>
                    </div>


                    {/* Main Table */}
                    <div className="flex-1 overflow-visible border-b border-black">
                      <table className="w-full border-collapse" style={{ height: '100%' }}>
                        <thead>
                          <tr className="border-b border-black text-[8pt] font-bold text-center h-[12mm] bg-white">
                            <th className="w-[6%] border-r border-black px-1 uppercase">Sr.<br/>No.</th>
                            <th className="w-[30%] border-r border-black px-2 uppercase items-start pt-2">Name of Product / Service</th>
                            <th className="w-[10%] border-r border-black px-1 uppercase">HSN / SAC</th>
                            <th className="w-[8%] border-r border-black px-1 uppercase">Qty</th>
                            <th className="w-[10%] border-r border-black px-1 uppercase">Rate</th>
                            <th className="w-[10%] border-r border-black px-1 uppercase">Taxable Value</th>
                            <th className="w-[16%] border-r border-black p-0 align-top">
                               <div className="border-b border-black text-center py-1 uppercase text-[7pt]">GST</div>
                               <div className="flex h-[calc(100%-20px)] w-full">
                                 <div className="flex-1 text-[7pt] uppercase border-r border-black text-center flex items-center justify-center">CGST</div>
                                 <div className="flex-1 text-[7pt] uppercase text-center flex items-center justify-center">SGST</div>
                               </div>
                            </th>
                            <th className="w-[10%] px-1 uppercase">Total</th>
                          </tr>
                        </thead>
                        <tbody className="text-[9pt] align-top">
                          {invoice.items.map((item, idx) => (
                            <tr key={idx} className="h-auto">
                              <td className="border-r border-black text-center p-2 font-medium">{idx + 1}</td>
                              <td className="border-r border-black p-2 font-black leading-tight text-[9.5pt]">{item.name}</td>
                              <td className="border-r border-black text-center p-2 font-medium opacity-60">{item.hsn}</td>
                              <td className="border-r border-black text-center p-2 font-black italic">{item.quantity} {item.unit || 'NOS'}</td>
                              <td className="border-r border-black text-right p-2 font-mono font-bold">{item.price.toFixed(2)}</td>
                              <td className="border-r border-black text-right p-2 font-mono font-bold">{(item.total - (item.cgst + item.sgst + (item.igst || 0))).toFixed(2)}</td>
                              <td className="border-r border-black p-0 h-full">
                                <div className="flex h-full w-full">
                                  <div className="flex-1 text-right p-2 font-mono text-[8pt] border-r border-black">{(item.cgst || (item.igst / 2) || 0).toFixed(2)}</div>
                                  <div className="flex-1 text-right p-2 font-mono text-[8pt]">{(item.sgst || (item.igst / 2) || 0).toFixed(2)}</div>
                                </div>
                              </td>
                              <td className="text-right p-2 font-black font-mono text-[10pt] text-slate-900">{item.total.toFixed(2)}</td>
                            </tr>
                          ))}
                          {/* Blank filler row to stretch to bottom */}
                          <tr>
                            <td className="border-r border-black border-b-[0px]"></td>
                            <td className="border-r border-black border-b-[0px]"></td>
                            <td className="border-r border-black border-b-[0px]"></td>
                            <td className="border-r border-black border-b-[0px]"></td>
                            <td className="border-r border-black border-b-[0px]"></td>
                            <td className="border-r border-black border-b-[0px]"></td>
                            <td className="border-r border-black border-b-[0px] p-0">
                               <div className="flex h-full w-full">
                                  <div className="flex-1 border-r border-black h-full min-h-[10mm]"></div>
                                  <div className="flex-1 h-full"></div>
                                </div>
                            </td>
                            <td className="border-b-[0px]"></td>
                          </tr>
                        </tbody>
                        <tfoot className="align-bottom">
                          <tr className="border-t border-black font-black bg-slate-50 h-[10mm] text-[9pt]">
                            <td className="border-r border-black text-right px-4 pr-10" colSpan={3}>Total</td>
                            <td className="border-r border-black text-center uppercase tracking-tighter">{invoice.items.reduce((sum, i) => sum + i.quantity, 0)} NOS</td>
                            <td className="border-r border-black"></td>
                            <td className="border-r border-black text-right px-3 font-mono">₹{invoice.subtotal.toFixed(2)}</td>
                            <td className="border-r border-black p-0 h-[10mm]">
                               <div className="flex w-full h-full">
                                  <div className="flex-1 border-r border-black text-right p-2 font-mono text-[8.5pt] flex items-center justify-end">{invoice.totalCgst.toFixed(2)}</div>
                                  <div className="flex-1 text-right p-2 font-mono text-[8.5pt] flex items-center justify-end">{invoice.totalSgst.toFixed(2)}</div>
                                </div>
                            </td>
                            <td className="text-right px-3 font-mono text-[10.5pt]">₹{invoice.totalAmount.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Footer - Total in Words */}
                    <div className="border-b border-black grid grid-cols-[180px,1fr] items-center min-h-[14mm] px-4 bg-white">
                      <span className="font-bold text-[8.5pt] uppercase text-slate-500 tracking-tight">Total amount in words</span>
                      <span className="font-black text-[10pt] uppercase tracking-tight text-slate-900 border-l border-black/10 pl-4 py-2">
                        {amountToWords(invoice.totalAmount, invoice.currency)} ONLY
                      </span>
                    </div>

                    {/* Bottom Split: Bank & Tax Summary */}
                    <div className="grid grid-cols-[1fr,320px] min-h-[60mm]">
                      {/* Left Side: Bank Details & Terms */}
                      <div className="border-r border-black flex flex-col bg-white">
                        <div className="bg-slate-100 text-center font-bold border-b border-black py-1 text-[8.5pt] uppercase tracking-widest text-slate-700">Bank Details</div>
                        <div className="flex flex-1 p-4 gap-6">
                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-[85px,1fr] text-[9pt] gap-y-2">
                              <span className="font-bold text-slate-400 uppercase text-[7pt]">Bank Name</span>
                              <span className="font-black text-slate-800 uppercase">{settings.bankName || 'ICICI BANK'}</span>
                              
                              <span className="font-bold text-slate-400 uppercase text-[7pt]">Branch</span>
                              <span className="font-black text-slate-800 uppercase">Surate</span>
                              
                              <span className="font-bold text-slate-400 uppercase text-[7pt]">Acc. Number</span>
                              <span className="font-black text-[12pt] text-slate-900 tracking-tight">{settings.accountNumber || '2715500356'}</span>
                              
                              <span className="font-bold text-slate-400 uppercase text-[7pt]">IFSC Code</span>
                              <span className="font-black text-slate-800 underline decoration-slate-200">{settings.ifscCode || 'ICIC045F'}</span>

                              <span className="font-bold text-slate-400 uppercase text-[7pt] mt-4">UPI ID</span>
                              <span className="font-black text-teal-600 mt-4 lowercase italic">{settings.upiId || 'ifox@icici'}</span>
                            </div>
                          </div>
                          <div className="w-[35mm] flex flex-col items-center justify-center pt-2">
                            <div className="p-1.5 border border-black/10 bg-white ring-1 ring-slate-100 mb-2">
                               {upiUrl ? (
                                 <QRCodeCanvas value={upiUrl} size={100} level="M" />
                               ) : (
                                 <div className="w-[100px] h-[100px] bg-slate-50 border border-dashed flex items-center justify-center text-slate-200">QR CODE</div>
                               )}
                            </div>
                            <span className="text-[7.5pt] font-black uppercase text-slate-400 tracking-wider">Pay using UPI</span>
                          </div>
                        </div>
                        <div className="border-t border-black p-4 bg-slate-50/70 border-b border-black">
                          <h4 className="text-[7.5pt] font-black uppercase mb-2 tracking-widest text-slate-800 border-b border-slate-200 inline-block">Terms and Conditions</h4>
                          <div className="text-[7.5pt] leading-relaxed font-bold text-slate-600 italic whitespace-pre-line">
                            {settings.terms || "Subject to Maharashtra Junction.\nOur Responsibility Ceases as soon as goods leaves our Premises.\nGoods once sold will not taken back.\nDelivery Ex-Premises."}
                          </div>
                          <div className="mt-4 pt-2 border-t border-slate-200">
                             <div className="text-[8pt] font-black uppercase text-slate-400">Customer Signature</div>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Calculation & Authorized Signatory */}
                      <div className="flex flex-col bg-white">
                        <div className="p-4 space-y-3 text-[10pt] border-b border-black">
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="font-bold uppercase text-[7.5pt]">Taxable Amount</span>
                            <span className="font-black font-mono">₹{invoice.subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="font-bold uppercase text-[7.5pt]">Add : CGST</span>
                            <span className="font-black font-mono">₹{(invoice.totalCgst || (invoice.totalIgst / 2)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="font-bold uppercase text-[7.5pt]">Add : SGST</span>
                            <span className="font-black font-mono">₹{(invoice.totalSgst || (invoice.totalIgst / 2)).toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col pt-3 mt-1 border-t-2 border-black">
                             <div className="flex justify-between items-center mb-1">
                               <span className="font-black uppercase text-[8.5pt] text-slate-900 tracking-tighter">Total Amount After Tax</span>
                               <span className="font-black text-[14pt] font-mono text-slate-950">₹{invoice.totalAmount.toFixed(2)}</span>
                             </div>
                             <div className="text-right text-[7.5pt] font-black text-slate-400 italic">(E & O.E.)</div>
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col p-4 text-center justify-between min-h-[40mm]">
                           <div className="text-[7.5pt] font-black leading-tight uppercase opacity-40 text-slate-900 tracking-tight">
                             Certified that the particulars given above are true and correct.
                           </div>
                           <div className="my-2">
                             <div className="text-[10pt] font-black uppercase tracking-tight text-slate-900">For {settings.companyName || 'GUJARAT FREIGHT TOOLS'}</div>
                           </div>
                           <div className="h-[18mm] flex items-center justify-center relative">
                             {settings.signatureUrl && (
                               <img src={settings.signatureUrl} alt="Signature" className="h-full w-auto max-w-full mix-blend-multiply brightness-75 contrast-125 saturate-0" />
                             )}
                             <p className="absolute text-[8pt] text-slate-300 font-mono opacity-20 pointer-events-none uppercase -rotate-6 select-none">DIGITALLY SIGNED</p>
                           </div>
                           <div className="border-t border-black pt-2">
                             <div className="text-[10pt] font-black uppercase tracking-[0.25em] text-slate-800">Authorised Signatory</div>
                           </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Floating Seal/Watermark like Note */}
                    <div className="absolute right-[450px] bottom-[20mm] pointer-events-none opacity-40">
                       <div className="border-2 border-slate-800 p-2 rounded-sm rotate-[-12deg] bg-white/50 inline-block text-center shadow-sm">
                          <p className="text-[8.5pt] font-black text-slate-800 tracking-tighter leading-tight uppercase">
                             This is a computer generated <br/> invoice no signature required.
                          </p>
                       </div>
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
