import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal,
  Eye,
  FileEdit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Loader2,
  Archive,
  FileDown,
  CheckSquare,
  Square,
  X,
  Zap,
  CreditCard
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useData, useSettings } from '@/hooks/useData';
import { useRBAC } from '@/hooks/useRBAC';
import { Invoice, Item } from '@/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { InvoiceView } from '@/components/invoices/InvoiceView';
import { toast } from 'sonner';
import { formatCurrency, generateNextInvoiceNumber } from '@/lib/invoice-utils';

export default function Invoices() {
  const location = useLocation();
  const { profile } = useRBAC();
  const { canCreate, canEdit, canDelete } = useRBAC();
  const { data: invoices, loading, addItem, updateItem, deleteItem } = useData<Invoice>('invoices');
  const { data: items, updateItem: updateProduct } = useData<Item>('items');
  const { settings } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Handle quick action from navigation state
  useEffect(() => {
    if (location.state?.create) {
      setIsCreating(true);
      // Clear state to avoid reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [isPaying, setIsPaying] = useState<string | null>(null);

  // Handle return from Stripe
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paid = params.get('paid');
    const invoiceId = params.get('id');

    if (paid === 'true' && invoiceId) {
      toast.success('Payment successful! Invoice updated.');
      updateItem(invoiceId, { status: 'Paid' });
      // Remove query params from URL
      window.history.replaceState({}, document.title, location.pathname);
    } else if (paid === 'false') {
      toast.error('Payment cancelled or failed.');
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location]);

  const handlePayNow = async (invoice: Invoice) => {
    try {
      setIsPaying(invoice.id);
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          items: invoice.items,
          customerEmail: invoice.clientEmail,
          currency: invoice.currency
        })
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);
      
      window.location.href = url;
    } catch (err) {
      console.error('Payment Error:', err);
      toast.error('Failed to initiate payment. Check if Stripe is configured.');
    } finally {
      setIsPaying(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredInvoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInvoices.map(inv => inv.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (invoiceData: Partial<Invoice>) => {
    try {
      if (editingInvoice) {
        await updateItem(editingInvoice.id, invoiceData);
        setEditingInvoice(null);
        toast.success('Invoice updated');
      } else {
        await addItem(invoiceData);
        // Deduct stock
        if (invoiceData.items) {
          for (const invoiceItem of invoiceData.items) {
            const product = items.find(i => i.id === invoiceItem.itemId);
            if (product) {
              const newStock = product.stock - invoiceItem.quantity;
              await updateProduct(product.id, { stock: newStock });
            }
          }
        }
        setIsCreating(false);
        toast.success('Invoice created and stock updated');
      }
    } catch (err) {
      toast.error('Failed to save invoice');
    }
  };

  const handleConvertToInvoice = async (inv: Invoice) => {
    try {
      await updateItem(inv.id, { 
        type: 'Tax Invoice', 
        status: 'Pending',
        invoiceNumber: generateNextInvoiceNumber(invoices, settings, inv.date)
      });
      toast.success('Converted to Tax Invoice');
    } catch (err) {
      toast.error('Failed to convert');
    }
  };

  const handleBulkExport = async (type: 'pdf' | 'zip') => {
    const selectedInvoices = invoices.filter(inv => selectedIds.includes(inv.id));
    if (selectedInvoices.length === 0) return;

    setIsBulkExporting(true);
    const toastId = toast.loading(`Preparing ${selectedInvoices.length} documents...`);

    try {
      // We'll implement this helper in a moment
      const { exportInvoices } = await import('@/lib/bulk-exporter');
      await exportInvoices(selectedInvoices, settings, type, (current, total) => {
        toast.loading(`Processing document ${current} of ${total}...`, { id: toastId });
      });
      toast.success('Export completed successfully', { id: toastId });
      setSelectedIds([]);
    } catch (err) {
      console.error('Bulk Export Error:', err);
      toast.error('Export failed. Please try again.', { id: toastId });
    } finally {
      setIsBulkExporting(false);
    }
  };

  const handleBulkEInvoice = async () => {
    const selectedInvoices = invoices.filter(inv => selectedIds.includes(inv.id));
    if (selectedInvoices.length === 0) return;

    const toastId = toast.loading(`Initiating Bulk E-Invoice for ${selectedInvoices.length} documents...`);
    
    try {
      for (let i = 0; i < selectedInvoices.length; i++) {
        const inv = selectedInvoices[i];
        toast.loading(`Registering IRN for ${inv.invoiceNumber} (${i + 1}/${selectedInvoices.length})...`, { id: toastId });
        
        // Simulate API latency
        await new Promise(resolve => setTimeout(resolve, 800));

        // Update invoice with mock IRN if it doesn't have one
        if (!inv.irn) {
          const mockIrn = Math.random().toString(16).substring(2, 64).toUpperCase();
          await updateItem(inv.id, { 
            irn: mockIrn,
            irnDate: new Date().toISOString()
          });
        }
      }
      
      toast.success(`Successfully generated IRNs for ${selectedInvoices.length} documents`, { id: toastId });
      setSelectedIds([]);
    } catch (err) {
      toast.error('Bulk E-Invoicing failed', { id: toastId });
    }
  };

  const handleBulkStatusUpdate = async (newStatus: Invoice['status']) => {
    if (selectedIds.length === 0) return;

    const toastId = toast.loading(`Updating status for ${selectedIds.length} documents...`);
    
    try {
      const updates = selectedIds.map(id => updateItem(id, { status: newStatus }));
      await Promise.all(updates);
      
      toast.success(`Updated ${selectedIds.length} documents to ${newStatus}`, { id: toastId });
      setSelectedIds([]);
    } catch (err) {
      console.error('Bulk Status Update Error:', err);
      toast.error('Bulk update failed. Please try again.', { id: toastId });
    }
  };

  const getStatusBadge = (invoice: Invoice) => {
    if (invoice.irn) {
      return <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-extrabold uppercase text-[10px] tracking-widest px-3 py-1 rounded-full ring-4 ring-blue-50/50 flex gap-1 items-center shadow-sm"><Zap className="w-2.5 h-2.5 fill-current" /> E-Way Sync</Badge>;
    }

    switch (invoice.status) {
      case 'Paid':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black uppercase text-[10px] tracking-widest px-3 py-1 rounded-full ring-4 ring-emerald-50/50">Paid</Badge>;
      case 'Pending':
        return <Badge className="bg-orange-50 text-orange-700 border-orange-100 font-black uppercase text-[10px] tracking-widest px-3 py-1 rounded-full ring-4 ring-orange-50/50">Pending</Badge>;
      case 'Cancelled':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-100 font-black uppercase text-[10px] tracking-widest px-3 py-1 rounded-full ring-4 ring-rose-50/50">Void</Badge>;
      default:
        return <Badge variant="outline" className="font-black uppercase text-[10px] tracking-widest px-3 py-1 rounded-full border-slate-200 text-slate-400">Draft</Badge>;
    }
  };

  if (isCreating || editingInvoice) {
    return (
      <InvoiceForm 
        settings={settings} 
        invoices={invoices}
        onSave={handleCreate} 
        onCancel={() => {
          setIsCreating(false);
          setEditingInvoice(null);
        }} 
        initialData={editingInvoice || undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      {viewingInvoice && settings && (
        <InvoiceView invoice={viewingInvoice} settings={settings} onClose={() => setViewingInvoice(null)} />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Document Ledger</h2>
          <p className="text-slate-500 text-sm font-medium">Unified manager for Tax Invoices, Quotations & Challans</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">
                {selectedIds.length} Selected
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger 
                  disabled={isBulkExporting} 
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 rounded-lg font-bold text-[10px] uppercase tracking-widest h-10 px-5 border-[#237227] text-[#237227]")}
                >
                  {isBulkExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Bulk Export
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl border-slate-100">
                  <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider" onClick={() => handleBulkExport('pdf')}>
                    <FileDown className="w-4 h-4 text-[#237227]" /> Single PDF Merge
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider" onClick={() => handleBulkExport('zip')}>
                    <Archive className="w-4 h-4 text-blue-600" /> ZIP Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-orange-600 focus:text-orange-600" onClick={() => handleBulkEInvoice()}>
                    <Zap className="w-4 h-4 fill-orange-600" /> Bulk E-Invoice (IRN)
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-emerald-600 focus:text-emerald-600" onClick={() => handleBulkStatusUpdate('Paid')}>
                    <CheckCircle2 className="w-4 h-4" /> Mark Selected as Paid
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-slate-600 focus:text-slate-600" onClick={() => handleBulkStatusUpdate('Pending')}>
                    <Clock className="w-4 h-4" /> Mark Selected as Pending
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-red-600 focus:text-red-600" onClick={() => handleBulkStatusUpdate('Cancelled')}>
                    <Archive className="w-4 h-4" /> Void Selected
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-red-600 focus:text-red-600 border-t mt-1" onClick={() => setSelectedIds([])}>
                    <X className="w-4 h-4" /> Cancel Selection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <>
              <Button variant="outline" size="sm" className="hidden sm:flex gap-2 rounded-lg font-bold text-[10px] uppercase tracking-widest h-10 px-5">
                <Download className="w-4 h-4" />
                Export Audit
              </Button>
              {canCreate && (
                <Button size="sm" className="gap-2 bg-[#237227] text-white hover:bg-[#1B561E] rounded-lg font-bold text-[10px] uppercase tracking-widest h-10 px-5 shadow-lg shadow-[#237227]/20" onClick={() => setIsCreating(true)}>
                  <Plus className="w-4 h-4" />
                  New Document
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search documents or clients..." 
            className="pl-10 border-slate-200 focus-visible:ring-[#237227] h-10 text-sm rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="ghost" size="sm" className="gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
          <Filter className="w-4 h-4" />
          Advanced Filters
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-transparent border-slate-200">
              <TableHead className="w-[40px]">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-slate-400"
                  onClick={toggleSelectAll}
                >
                  {selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-[#237227]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-[120px] sm:w-[140px] font-black text-[10px] uppercase tracking-widest text-slate-400">Doc Number</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Client / Customer</TableHead>
              <TableHead className="hidden sm:table-cell font-black text-[10px] uppercase tracking-widest text-center text-slate-400">Type</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center text-slate-400">Status</TableHead>
              <TableHead className="hidden lg:table-cell font-black text-[10px] uppercase tracking-widest text-slate-400">Issue Date</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right text-slate-400">Amount</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-20">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing with server...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-20 text-slate-400 italic text-sm">No records matching your search</TableCell>
              </TableRow>
            ) : filteredInvoices.map((inv) => (
              <TableRow key={inv.id} className={cn("hover:bg-slate-50 transition-colors group border-slate-100", selectedIds.includes(inv.id) && "bg-slate-50")}>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-300 hover:text-[#237227]"
                    onClick={() => toggleSelectOne(inv.id)}
                  >
                    {selectedIds.includes(inv.id) ? (
                      <CheckSquare className="w-4 h-4 text-[#237227]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="font-mono font-bold text-slate-900 border-l-4 border-transparent group-hover:border-[#237227] transition-all text-xs sm:text-sm">{inv.invoiceNumber}</TableCell>
                <TableCell>
                  <div className="font-black text-slate-900 text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{inv.clientName}</div>
                  <div className="hidden sm:block text-[10px] font-mono text-slate-400 font-bold uppercase truncate max-w-[150px]">{inv.clientGstin || 'NO GSTIN'}</div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-center">
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter rounded-full border-slate-200 text-slate-500">{inv.type}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(inv)}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-slate-500 text-xs font-bold tabular-nums">
                  {format(new Date(inv.date), 'dd MMM yyyy')}
                </TableCell>
                <TableCell className="text-right font-black text-xs sm:text-sm font-mono text-slate-900 whitespace-nowrap">
                  {formatCurrency(inv.totalAmount, inv.currency)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-full")}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl border-slate-100">
                      <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider" onClick={() => setViewingInvoice(inv)}>
                        <Eye className="w-4 h-4 text-[#237227]" /> View Document
                      </DropdownMenuItem>
                      {inv.status !== 'Paid' && (
                        <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-emerald-600 focus:text-emerald-600" onClick={() => handlePayNow(inv)}>
                          {isPaying === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                          Pay Online
                        </DropdownMenuItem>
                      )}
                      {canEdit && (inv.type === 'Proforma' || inv.type === 'Delivery Challan') && (
                        <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-[#237227] focus:text-[#237227]" onClick={() => handleConvertToInvoice(inv)}>
                          <FileCheck2 className="w-4 h-4" /> Convert to Invoice
                        </DropdownMenuItem>
                      )}
                      {canEdit && (
                        <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider" onClick={() => setEditingInvoice(inv)}>
                          <FileEdit className="w-4 h-4 text-yellow-500" /> Edit Revision
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => deleteItem(inv.id)}>
                          <Trash2 className="w-4 h-4" /> Delete Permanently
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
