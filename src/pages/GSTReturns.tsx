import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileJson, 
  FileDown, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ExternalLink,
  ChevronDown,
  LayoutDashboard,
  FileText,
  HelpCircle,
  Download,
  Table as TableIcon,
  CheckSquare,
  Zap,
  IndianRupee,
  Calendar,
  Filter
} from 'lucide-react';
import { useData, useSettings } from '@/hooks/useData';
import { Invoice, BusinessSettings } from '@/types';
import { formatCurrency } from '@/lib/invoice-utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  parseISO, 
  getYear, 
  getMonth 
} from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function GSTReturns() {
  const { data: invoices, loading } = useData<Invoice>('invoices');
  const { settings } = useSettings();
  
  const [periodType, setPeriodType] = useState<'Monthly' | 'Quarterly'>('Monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [activeTab, setActiveTab] = useState('gstr-1');

  // --- Calculations ---
  
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const invDate = parseISO(inv.date);
      if (periodType === 'Monthly') {
        return getYear(invDate) === selectedYear && getMonth(invDate) === selectedMonth;
      } else {
        const quarter = Math.floor(selectedMonth / 3);
        const invQuarter = Math.floor(getMonth(invDate) / 3);
        return getYear(invDate) === selectedYear && invQuarter === quarter;
      }
    });
  }, [invoices, periodType, selectedYear, selectedMonth]);

  const stats = useMemo(() => {
    const totalInvoices = filteredInvoices.length;
    const taxableAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const taxAmount = filteredInvoices.reduce((sum, inv) => sum + ((inv.totalIgst || 0) + (inv.totalCgst || 0) + (inv.totalSgst || 0)), 0);
    return {
      count: totalInvoices,
      taxable: taxableAmount,
      tax: taxAmount,
      netPayable: taxAmount // Simplified
    };
  }, [filteredInvoices]);

  const b2bInvoices = useMemo(() => filteredInvoices.filter(inv => inv.clientGstin), [filteredInvoices]);
  const b2cInvoices = useMemo(() => filteredInvoices.filter(inv => !inv.clientGstin), [filteredInvoices]);

  const hsnSummary = useMemo(() => {
    const summary: Record<string, { hsn: string, description: string, qty: number, taxable: number, cgst: number, sgst: number, igst: number }> = {};
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const hsn = item.hsn || 'N/A';
        if (!summary[hsn]) {
          summary[hsn] = { hsn, description: item.name, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        }
        summary[hsn].qty += item.quantity;
        summary[hsn].taxable += (item.price * item.quantity);
        summary[hsn].cgst += (item.cgst || 0);
        summary[hsn].sgst += (item.sgst || 0);
        summary[hsn].igst += (item.igst || 0);
      });
    });
    return Object.values(summary);
  }, [filteredInvoices]);

  const docSummary = useMemo(() => {
    if (filteredInvoices.length === 0) return null;
    const sorted = [...filteredInvoices].sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
    return {
      from: sorted[0]?.invoiceNumber,
      to: sorted[sorted.length - 1]?.invoiceNumber,
      total: filteredInvoices.length,
      cancelled: 0 // Mocked for now
    };
  }, [filteredInvoices]);

  // JSON Export Logic (Simplified Schema)
  const handleJSONExport = () => {
    const gstr1Data = {
      gstin: settings?.gstin || 'GSTIN_NOT_SET',
      fp: `${selectedMonth + 1 < 10 ? '0' : ''}${selectedMonth + 1}${selectedYear}`,
      cur_gt: 0,
      gt: 0,
      b2b: b2bInvoices.map(inv => ({
        ctin: inv.clientGstin,
        inv: [{
          inum: inv.invoiceNumber,
          idt: format(parseISO(inv.date), 'dd-MM-yyyy'),
          val: inv.totalAmount,
          pos: inv.clientStateCode || settings?.stateCode,
          rchrg: 'N',
          inv_typ: 'R',
          itms: [{
            num: 1,
            itm_det: {
              rt: inv.items[0]?.gstRate || 0,
              txval: inv.subtotal,
              iamt: inv.totalIgst || 0,
              camt: inv.totalCgst || 0,
              samt: inv.totalSgst || 0,
              csamt: 0
            }
          }]
        }]
      }))
    };

    const blob = new Blob([JSON.stringify(gstr1Data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${selectedYear}_${selectedMonth + 1}.json`;
    a.click();
    toast.success('GSTR-1 JSON Exported');
  };

  const downloadCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const str = String(cell ?? '').replace(/"/g, '""');
        return `"${str}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVExport = (type: string) => {
    const periodLabel = `${months[selectedMonth]}_${selectedYear}`;
    
    switch (type) {
      case 'B2B': {
        const headers = ['GSTIN', 'Client Name', 'Invoice Number', 'Date', 'Invoice Value', 'POS', 'Reverse Charge', 'Invoice Type', 'Tax Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'];
        const rows = b2bInvoices.map(inv => [
          inv.clientGstin,
          inv.clientName,
          inv.invoiceNumber,
          format(parseISO(inv.date), 'dd-MMM-yyyy'),
          inv.totalAmount,
          inv.clientStateCode || settings?.stateCode,
          'N',
          'Regular',
          inv.items[0]?.gstRate || 0,
          inv.subtotal,
          inv.totalIgst || 0,
          inv.totalCgst || 0,
          inv.totalSgst || 0,
          0
        ]);
        downloadCSV(`GSTR1_B2B_${periodLabel}.csv`, headers, rows);
        toast.success('B2B CSV Exported');
        break;
      }
      case 'B2C': {
        const headers = ['Type', 'State Code', 'Tax Rate', 'Taxable Value', 'Cess'];
        // Group by state and rate
        const b2csData: Record<string, { state: string, rate: number, taxable: number }> = {};
        b2cInvoices.forEach(inv => {
          const state = inv.clientStateCode || settings?.stateCode || '00';
          inv.items.forEach(item => {
            const key = `${state}_${item.gstRate}`;
            if (!b2csData[key]) b2csData[key] = { state, rate: item.gstRate, taxable: 0 };
            b2csData[key].taxable += (item.price * item.quantity);
          });
        });
        const rows = Object.values(b2csData).map(d => [
          'OE',
          d.state,
          d.rate,
          d.taxable.toFixed(2),
          0
        ]);
        downloadCSV(`GSTR1_B2C_${periodLabel}.csv`, headers, rows);
        toast.success('B2C CSV Exported');
        break;
      }
      case 'HSN': {
        const headers = ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'];
        const rows = hsnSummary.map(h => [
          h.hsn,
          h.description,
          'OTH-OTHERS',
          h.qty,
          (h.taxable + h.igst + h.cgst + h.sgst).toFixed(2),
          h.taxable.toFixed(2),
          h.igst.toFixed(2),
          h.cgst.toFixed(2),
          h.sgst.toFixed(2),
          0
        ]);
        downloadCSV(`GSTR1_HSN_${periodLabel}.csv`, headers, rows);
        toast.success('HSN CSV Exported');
        break;
      }
      case 'CDNR': {
        const headers = ['GSTIN', 'Note Number', 'Note Date', 'Note Type', 'POS', 'Note Value', 'Tax Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'];
        const cdnInvoices = filteredInvoices.filter(inv => inv.type === 'Credit Note' && inv.clientGstin);
        const rows = cdnInvoices.map(inv => [
          inv.clientGstin,
          inv.invoiceNumber,
          format(parseISO(inv.date), 'dd-MMM-yyyy'),
          'C',
          inv.clientStateCode || settings?.stateCode,
          inv.totalAmount,
          inv.items[0]?.gstRate || 0,
          inv.subtotal,
          inv.totalIgst || 0,
          inv.totalCgst || 0,
          inv.totalSgst || 0,
          0
        ]);
        downloadCSV(`GSTR1_CDNR_${periodLabel}.csv`, headers, rows);
        toast.success('CDNR CSV Exported');
        break;
      }
      case 'Docs': {
        const headers = ['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled', 'Net Issued'];
        const rows = [];
        if (docSummary) {
          rows.push([
            'Invoices for outward supply',
            docSummary.from,
            docSummary.to,
            docSummary.total,
            docSummary.cancelled,
            docSummary.total - docSummary.cancelled
          ]);
        }
        downloadCSV(`GSTR1_Docs_${periodLabel}.csv`, headers, rows);
        toast.success('Document Summary CSV Exported');
        break;
      }
      default:
        toast.error('Unknown export type');
    }
  };

  const handleGSTPortal = () => {
    window.open('https://services.gst.gov.in/services/login', '_blank');
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading) return <div>Loading GST Data...</div>;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">GST Returns</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl font-bold gap-2">
                    {periodType} <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40 p-2 rounded-xl">
                  {['Monthly', 'Quarterly'].map(t => (
                    <DropdownMenuItem key={t} onClick={() => setPeriodType(t as any)} className="font-bold text-xs uppercase tracking-wider">
                      {t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl font-bold gap-2">
                    {months[selectedMonth]} <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="h-64 overflow-auto p-2 rounded-xl">
                  {months.map((m, idx) => (
                    <DropdownMenuItem key={m} onClick={() => setSelectedMonth(idx)} className="font-bold text-xs uppercase tracking-wider">
                      {m}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl font-bold gap-2">
                    {selectedYear} <ChevronDown className="w-4 h-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="p-2 rounded-xl">
                  {years.map(y => (
                    <DropdownMenuItem key={y} onClick={() => setSelectedYear(y)} className="font-bold text-xs uppercase tracking-wider">
                      {y}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div className="flex gap-2">
              <Badge className="bg-red-50 text-red-600 border-red-100 px-3 py-1 font-black text-[10px] uppercase tracking-widest">R1 Pending</Badge>
              <Badge className="bg-orange-50 text-orange-600 border-orange-100 px-3 py-1 font-black text-[10px] uppercase tracking-widest">3B Pending</Badge>
            </div>
          </div>
        </div>
        <Button onClick={handleGSTPortal} className="bg-[#1D4ED8] hover:bg-blue-800 text-white font-black px-8 h-12 rounded-xl shadow-lg flex gap-2 items-center">
          <ExternalLink className="w-4 h-4" /> GST Portal
        </Button>
      </div>

      {/* Warnings & Alerts */}
      <AnimatePresence>
        {filteredInvoices.some(inv => inv.clientGstin && inv.clientGstin.length !== 15) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-800"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">
              {filteredInvoices.filter(inv => inv.clientGstin && inv.clientGstin.length !== 15).length} Invoices have invalid client GSTIN formats.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Invoices', value: stats.count, icon: FileText, color: 'text-blue-600' },
          { label: 'Taxable Amount', value: formatCurrency(stats.taxable), icon: IndianRupee, color: 'text-slate-900' },
          { label: 'GST Collected', value: formatCurrency(stats.tax), icon: Zap, color: 'text-[#FFAA00]' },
          { label: 'Net Payable', value: formatCurrency(stats.netPayable), icon: CheckCircle2, color: 'text-[#237227]' },
        ].map((stat, i) => (
          <Card key={i} className="p-6 rounded-3xl border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-slate-50 rounded-xl">
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</div>
            <div className="text-2xl font-black text-slate-900">{stat.value}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="gstr-1" onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100/50 p-1.5 rounded-2xl mb-8 w-fit gap-2">
          <TabsTrigger value="gstr-1" className="rounded-xl px-8 h-10 data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-[#237227] font-black uppercase text-[10px] tracking-widest transition-all">
             GSTR-1
          </TabsTrigger>
          <TabsTrigger value="gstr-3b" className="rounded-xl px-8 h-10 data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-[#237227] font-black uppercase text-[10px] tracking-widest transition-all">
             GSTR-3B
          </TabsTrigger>
          <TabsTrigger value="filing-guide" className="rounded-xl px-8 h-10 data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-[#237227] font-black uppercase text-[10px] tracking-widest transition-all">
             Filing Guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gstr-1" className="space-y-8 outline-none">
          {/* Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-4 px-2 border-y border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleJSONExport} className="bg-sidebar-accent text-white hover:bg-sidebar-accent/90 px-6 rounded-xl font-bold gap-2 text-xs h-10">
                <FileJson className="w-4 h-4" /> JSON Export
              </Button>
              <Button variant="outline" onClick={() => handleCSVExport('B2B')} className="rounded-xl font-bold gap-2 text-xs h-10 px-6">
                <FileDown className="w-4 h-4" /> B2B
              </Button>
              <Button variant="outline" onClick={() => handleCSVExport('B2C')} className="rounded-xl font-bold gap-2 text-xs h-10 px-6">
                <FileDown className="w-4 h-4" /> B2C
              </Button>
              <Button variant="outline" onClick={() => handleCSVExport('HSN')} className="rounded-xl font-bold gap-2 text-xs h-10 px-6">
                <FileDown className="w-4 h-4" /> HSN
              </Button>
              <Button variant="outline" onClick={() => handleCSVExport('CDNR')} className="rounded-xl font-bold gap-2 text-xs h-10 px-6">
                <FileDown className="w-4 h-4" /> CDNR
              </Button>
              <Button variant="outline" onClick={() => handleCSVExport('Docs')} className="rounded-xl font-bold gap-2 text-xs h-10 px-6">
                <FileDown className="w-4 h-4" /> Docs
              </Button>
            </div>
            <Button variant="ghost" className="text-[#237227] hover:bg-[#237227]/10 font-black text-[10px] uppercase tracking-widest h-10 gap-2 border-2 border-[#237227]/20 rounded-xl px-6">
              <CheckCircle2 className="w-4 h-4" /> Mark Filed
            </Button>
          </div>

          {/* B2B Table */}
          <Card className="rounded-3xl border-slate-100 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-800">B2B Sales — Table 4A</h3>
              <p className="text-xs text-slate-500 font-medium">{b2bInvoices.length} invoices registered with GSTIN</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/30 text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">GSTIN</th>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Invoice No</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">POS</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4 text-right">Taxable</th>
                    <th className="px-6 py-4 text-right">CGST</th>
                    <th className="px-6 py-4 text-right">SGST</th>
                    <th className="px-6 py-4 text-right">IGST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {b2bInvoices.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-blue-600 font-bold">{inv.clientGstin}</td>
                      <td className="px-6 py-4 font-black uppercase tracking-tight">{inv.clientName}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-400">{inv.invoiceNumber}</td>
                      <td className="px-6 py-4 font-bold text-slate-500">{format(parseISO(inv.date), 'dd/MM/yyyy')}</td>
                      <td className="px-6 py-4 font-bold uppercase">{inv.clientStateCode || settings?.stateCode}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-[10px] uppercase font-black tracking-tighter">
                          {inv.totalIgst > 0 ? 'Inter' : 'Intra'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right font-black">{formatCurrency(inv.subtotal)}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-500">{formatCurrency(inv.totalCgst || 0)}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-500">{formatCurrency(inv.totalSgst || 0)}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-500">{formatCurrency(inv.totalIgst || 0)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black border-t-2 border-slate-100">
                    <td colSpan={6} className="px-6 py-4 uppercase tracking-widest text-slate-400">B2B Total</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(b2bInvoices.reduce((s, i) => s + i.subtotal, 0))}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(b2bInvoices.reduce((s, i) => s + (i.totalCgst || 0), 0))}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(b2bInvoices.reduce((s, i) => s + (i.totalSgst || 0), 0))}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(b2bInvoices.reduce((s, i) => s + (i.totalIgst || 0), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* B2C Table */}
          <Card className="rounded-3xl border-slate-100 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-800">B2C Sales — Table 7</h3>
              <p className="text-xs text-slate-500 font-medium">{b2cInvoices.length} invoices to unregistered persons</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/30 text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Rate %</th>
                    <th className="px-6 py-4 text-right">Taxable</th>
                    <th className="px-6 py-4 text-right">CGST</th>
                    <th className="px-6 py-4 text-right">SGST</th>
                    <th className="px-6 py-4 text-right">IGST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Array.from(new Set(b2cInvoices.flatMap(inv => inv.items.map(i => i.gstRate)))).map((rate, idx) => {
                    const taxable = b2cInvoices.reduce((s, inv) => s + inv.items.filter(i => i.gstRate === rate).reduce((sum, item) => sum + (item.price * item.quantity), 0), 0);
                    const cgst = b2cInvoices.reduce((s, inv) => s + inv.items.filter(i => i.gstRate === rate).reduce((sum, item) => sum + (item.cgst || 0), 0), 0);
                    const sgst = b2cInvoices.reduce((s, inv) => s + inv.items.filter(i => i.gstRate === rate).reduce((sum, item) => sum + (item.sgst || 0), 0), 0);
                    const igst = b2cInvoices.reduce((s, inv) => s + inv.items.filter(i => i.gstRate === rate).reduce((sum, item) => sum + (item.igst || 0), 0), 0);
                    
                    return (
                      <tr key={idx}>
                        <td className="px-6 py-4"><Badge variant="outline" className="font-bold">{rate}%</Badge></td>
                        <td className="px-6 py-4 text-right font-bold">{formatCurrency(taxable)}</td>
                        <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(cgst)}</td>
                        <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(sgst)}</td>
                        <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(igst)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-black border-t-2 border-slate-100">
                    <td className="px-6 py-4 uppercase tracking-widest text-slate-400">B2C Total</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(b2cInvoices.reduce((s, i) => s + i.subtotal, 0))}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(b2cInvoices.reduce((s, i) => s + (i.totalCgst || 0), 0))}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(b2cInvoices.reduce((s, i) => s + (i.totalSgst || 0), 0))}</td>
                    <td className="px-6 py-4 text-right">{formatCurrency(b2cInvoices.reduce((s, i) => s + (i.totalIgst || 0), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* HSN Summary */}
            <Card className="rounded-3xl border-slate-100 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <h3 className="text-lg font-black text-slate-800">HSN Summary — Table 12</h3>
                <p className="text-xs text-slate-500 font-medium">{hsnSummary.length} codes found</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/30 text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">HSN</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4 text-center">Qty</th>
                      <th className="px-6 py-4 text-right">Taxable</th>
                      <th className="px-6 py-4 text-right">CGST</th>
                      <th className="px-6 py-4 text-right">SGST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {hsnSummary.map((hsn, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4"><Badge className="bg-blue-50 text-blue-600 font-bold">{hsn.hsn}</Badge></td>
                        <td className="px-6 py-4 font-black uppercase tracking-tighter text-[10px]">{hsn.description}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-500">{hsn.qty}</td>
                        <td className="px-6 py-4 text-right font-black">{formatCurrency(hsn.taxable)}</td>
                        <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(hsn.cgst)}</td>
                        <td className="px-6 py-4 text-right text-slate-500">{formatCurrency(hsn.sgst)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black">
                      <td colSpan={2} className="px-6 py-4">Total</td>
                      <td className="px-6 py-4 text-center">{hsnSummary.reduce((s, h) => s + h.qty, 0)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(hsnSummary.reduce((s, h) => s + h.taxable, 0))}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(hsnSummary.reduce((s, h) => s + h.cgst, 0))}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(hsnSummary.reduce((s, h) => s + h.sgst, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Document Summary */}
            <Card className="rounded-3xl border-slate-100 overflow-hidden shadow-sm h-fit">
              <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                <h3 className="text-lg font-black text-slate-800">Document Summary — Table 13</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/30 text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Document Type</th>
                      <th className="px-6 py-4">From</th>
                      <th className="px-6 py-4">To</th>
                      <th className="px-6 py-4 text-right">Total Issued</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {docSummary && (
                      <tr>
                        <td className="px-6 py-4 font-black">Tax Invoice</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-400">{docSummary.from}</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-400">{docSummary.to}</td>
                        <td className="px-6 py-4 text-right font-black">{docSummary.total}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Table Totals */}
          <Card className="p-8 rounded-3xl border-slate-100 shadow-sm bg-slate-50/30">
            <h3 className="text-lg font-black text-slate-800 mb-6">GSTR-1 Summary Totals</h3>
            <div className="space-y-4">
              {[
                { label: 'B2B Sales', taxable: b2bInvoices.reduce((s, i) => s + i.subtotal, 0), cgst: b2bInvoices.reduce((s, i) => s + (i.totalCgst || 0), 0), sgst: b2bInvoices.reduce((s, i) => s + (i.totalSgst || 0), 0), igst: b2bInvoices.reduce((s, i) => s + (i.totalIgst || 0), 0) },
                { label: 'B2C Sales', taxable: b2cInvoices.reduce((s, i) => s + i.subtotal, 0), cgst: b2cInvoices.reduce((s, i) => s + (i.totalCgst || 0), 0), sgst: b2cInvoices.reduce((s, i) => s + (i.totalSgst || 0), 0), igst: b2cInvoices.reduce((s, i) => s + (i.totalIgst || 0), 0) }
              ].map((row, i) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-slate-100 last:border-0 gap-4">
                  <div className="text-sm font-black uppercase tracking-widest text-slate-400">{row.label}</div>
                  <div className="flex flex-wrap items-center gap-8 text-xs font-bold">
                    <div className="text-right">
                      <div className="text-slate-400 uppercase tracking-tighter text-[9px] mb-1 font-black">Taxable</div>
                      <div className="text-slate-900">{formatCurrency(row.taxable)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 uppercase tracking-tighter text-[9px] mb-1 font-black">CGST</div>
                      <div className="text-slate-500">{formatCurrency(row.cgst)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 uppercase tracking-tighter text-[9px] mb-1 font-black">SGST</div>
                      <div className="text-slate-500">{formatCurrency(row.sgst)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 uppercase tracking-tighter text-[9px] mb-1 font-black">IGST</div>
                      <div className="text-slate-500">{formatCurrency(row.igst)}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex flex-col md:flex-row md:items-center justify-between py-6 mt-4 border-t-2 border-slate-200">
                <div className="text-base font-black uppercase tracking-widest text-slate-800">Grand Total</div>
                <div className="flex flex-wrap items-center gap-8 text-sm font-black">
                  <div className="text-right">
                    <div className="text-slate-900 border-b-2 border-slate-200 pb-1">{formatCurrency(stats.taxable)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-700 border-b-2 border-slate-200 pb-1">{formatCurrency(filteredInvoices.reduce((s, i) => s + (i.totalCgst || 0), 0))}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-700 border-b-2 border-slate-200 pb-1">{formatCurrency(filteredInvoices.reduce((s, i) => s + (i.totalSgst || 0), 0))}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-700 border-b-2 border-slate-200 pb-1">{formatCurrency(filteredInvoices.reduce((s, i) => s + (i.totalIgst || 0), 0))}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="gstr-3b" className="space-y-8 outline-none">
          <Card className="p-8 rounded-3xl border-slate-100 shadow-sm border-l-4 border-l-[#237227]">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-slate-50 rounded-2xl text-[#237227]">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">GSTR-3B Computation</h3>
                <p className="text-sm text-slate-500 font-medium tracking-tight">Summary of outward supplies and input tax credit</p>
              </div>
            </div>

            <div className="space-y-12">
              {/* Output Tax */}
              <div className="space-y-6">
                <h4 className="text-sm font-black uppercase tracking-widest text-[#FFAA00] flex items-center gap-4 after:content-[''] after:h-[1px] after:bg-slate-100 after:flex-1">
                  1. Outward Taxable Supplies
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mb-1">Total Taxable Value</div>
                    <div className="text-lg font-black">{formatCurrency(stats.taxable)}</div>
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="text-[9px] font-black uppercase tracking-tighter text-[#237227] mb-1">IGST</div>
                    <div className="text-lg font-black">{formatCurrency(filteredInvoices.reduce((s, i) => s + (i.totalIgst || 0), 0))}</div>
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="text-[9px] font-black uppercase tracking-tighter text-blue-600 mb-1">CGST</div>
                    <div className="text-lg font-black">{formatCurrency(filteredInvoices.reduce((s, i) => s + (i.totalCgst || 0), 0))}</div>
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="text-[9px] font-black uppercase tracking-tighter text-orange-600 mb-1">SGST</div>
                    <div className="text-lg font-black">{formatCurrency(filteredInvoices.reduce((s, i) => s + (i.totalSgst || 0), 0))}</div>
                  </div>
                </div>
              </div>

              {/* ITC */}
              <div className="space-y-6">
                <h4 className="text-sm font-black uppercase tracking-widest text-[#237227] flex items-center gap-4 after:content-[''] after:h-[1px] after:bg-slate-100 after:flex-1">
                  2. Eligible ITC (Input Tax Credit)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="p-4 bg-green-50/30 rounded-2xl border border-green-100">
                    <div className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mb-1">Total ITC Available</div>
                    <div className="text-lg font-black text-[#237227]">{formatCurrency(0)}</div>
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 opacity-50">
                    <div className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mb-1">Import of Goods</div>
                    <div className="text-lg font-black">₹0.00</div>
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 opacity-50">
                    <div className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mb-1">Import of Services</div>
                    <div className="text-lg font-black">₹0.00</div>
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 opacity-50">
                    <div className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mb-1">Reverse Charge</div>
                    <div className="text-lg font-black">₹0.00</div>
                  </div>
                </div>
              </div>

              {/* Net Payable */}
              <div className="pt-8 border-t-4 border-double border-slate-100">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Net Tax Payable</div>
                    <div className="text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(stats.tax)}</div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-red-500 font-bold uppercase tracking-widest">
                       <AlertCircle className="w-3 h-3" /> Due before 20th of next month
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Button variant="outline" className="h-12 px-8 rounded-xl font-bold gap-2">
                       <Download className="w-4 h-4" /> Download 3B Summary
                    </Button>
                    <Button className="h-12 px-8 rounded-xl font-black bg-[#237227] hover:bg-green-800 text-white shadow-lg shadow-green-100">
                       Proceed to File
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="filing-guide" className="space-y-8 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Card className="p-8 rounded-3xl border-slate-100 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                  <HelpCircle className="w-6 h-6 text-blue-600" />
                  How to File GSTR-1
                </h3>
                <div className="space-y-8">
                   {[
                     { step: 1, title: 'Download JSON', desc: 'Click on "JSON Export" button in GSTR-1 tab to get yours data in government format.' },
                     { step: 2, title: 'Login to GST Portal', desc: 'Visit services.gst.gov.in and login with your credentials.' },
                     { step: 3, title: 'Navigate to Returns', desc: 'Go to Services > Returns > Returns Dashboard. Select Financial Year and Month.' },
                     { step: 4, title: 'GSTR-1 Offline Tool', desc: 'Choose GSTR-1 (Prepare Offline) and upload the downloaded JSON file.' },
                     { step: 5, title: 'Generate Summary', desc: 'Wait for 2-5 minutes, then generate summary and verify totals with Zeone data.' },
                     { step: 6, title: 'File with EVC/DSC', desc: 'Proceed to file with EVC (Aadhar OTP) or DSC.' },
                   ].map((s, i) => (
                     <div key={i} className="flex gap-6">
                        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border-2 border-white shadow-sm font-black text-blue-600">
                          {s.step}
                        </div>
                        <div className="pt-1">
                          <div className="text-sm font-black text-slate-800 mb-1">{s.title}</div>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">{s.desc}</p>
                        </div>
                     </div>
                   ))}
                </div>
              </Card>

              <Card className="p-8 rounded-3xl border-slate-100 shadow-sm bg-orange-50/30">
                <h3 className="text-xl font-black text-slate-900 mb-6">NIL Return Filing</h3>
                <p className="text-sm text-slate-600 mb-6 font-medium">If you have zero sales in this period, you can file a NIL return via SMS quickly.</p>
                <div className="p-6 bg-white rounded-2xl border border-orange-100 shadow-sm">
                   <div className="flex items-center gap-3 mb-4">
                     <div className="w-2 h-2 rounded-full bg-orange-400" />
                     <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">SMS Format</div>
                   </div>
                   <div className="text-lg font-mono font-black text-slate-800 tracking-wider text-center py-4 bg-slate-50 rounded-xl mb-4 border-2 border-dashed border-slate-200">
                     NIL R1 27XXXXXXXXXXXXZ 042024
                   </div>
                   <p className="text-[10px] text-slate-400 text-center font-bold uppercase">Send to 14409 from registered mobile number</p>
                </div>
              </Card>
            </div>

            <div className="space-y-8">
              <Card className="p-8 rounded-3xl border-slate-100 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-[#237227]" /> Filing Checklist
                </h3>
                <div className="space-y-4">
                  {[
                    'Verify all B2B GSTINs',
                    'Check total document counts',
                    'Reconcile with Purchase Book',
                    'Ensure all HSN codes are valid',
                    'Validate Credit/Debit notes',
                    'Handle Inter-state tax rates',
                    'Check for NIL supplies',
                    'Clear any pending tax liability'
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 group cursor-pointer">
                      <div className="w-5 h-5 rounded-lg border-2 border-slate-200 group-hover:border-[#237227] transition-all flex items-center justify-center">
                        <div className="w-2 h-2 bg-[#237227] rounded-sm opacity-0 group-hover:opacity-100" />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-8 rounded-3xl border-slate-100 shadow-sm h-fit">
                 <h3 className="text-lg font-black text-slate-900 mb-6">Upcoming Deadlines</h3>
                 <div className="space-y-6">
                    {[
                      { type: 'GSTR-1', date: '11th May 2024', status: 'Upcoming' },
                      { type: 'IFF (QRMP)', date: '13th May 2024', status: 'Optional' },
                      { type: 'GSTR-3B', date: '20th May 2024', status: 'Important' },
                    ].map((d, i) => (
                      <div key={i} className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-black text-slate-800">{d.type}</div>
                          <div className="text-[10px] text-slate-400 font-bold">{d.date}</div>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[9px] uppercase font-black",
                          d.status === 'Important' ? 'text-red-600 bg-red-50 border-red-100' : 'text-slate-400'
                        )}>{d.status}</Badge>
                      </div>
                    ))}
                 </div>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
