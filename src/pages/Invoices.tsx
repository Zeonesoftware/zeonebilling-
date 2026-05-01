import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Truck
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { InvoiceView } from '@/components/invoices/InvoiceView';
import { BulkEInvoiceManager } from '@/components/invoices/BulkEInvoiceManager';
import { toast } from 'sonner';
import { formatCurrency, generateNextInvoiceNumber, extractSequence } from '@/lib/invoice-utils';

export default function Invoices() {
  const location = useLocation();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete, isBilling, canGenerateEInvoice, profile } = useRBAC();
  const { data: invoices, loading, addItem, updateItem, deleteItem } = useData<Invoice>('invoices');
  const { data: items, updateItem: updateProduct } = useData<Item>('items');
  const { settings, updateSettings } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [sortKey, setSortKey] = useState<keyof Invoice>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
  const [isBulkEInvoicing, setIsBulkEInvoicing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [isExportingAudit, setIsExportingAudit] = useState(false);
  const [isPaying, setIsPaying] = useState<string | null>(null);

  // ... (existing code)

  const handleExportAudit = async () => {
    setIsExportingAudit(true);
    const toastId = toast.loading('Preparing audit export...');
    try {
      const headers = ['Date', 'Type', 'Number', 'Client', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Status'];
      const rows = filteredInvoices.map(inv => [
        inv.date,
        inv.type,
        inv.invoiceNumber,
        inv.clientName,
        inv.clientGstin || '',
        inv.subtotal.toFixed(2),
        (inv.totalCgst || 0).toFixed(2),
        (inv.totalSgst || 0).toFixed(2),
        (inv.totalIgst || 0).toFixed(2),
        inv.totalAmount.toFixed(2),
        inv.status
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Invoice_Audit_Log_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Audit log exported', { id: toastId });
    } catch (error) {
      toast.error('Failed to export audit', { id: toastId });
    } finally {
      setIsExportingAudit(false);
    }
  };
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [ewayPromptInvoice, setEwayPromptInvoice] = useState<Invoice | null>(null);

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

  const handlePayNow = (invoice: Invoice) => {
    navigate(`/payment/${invoice.id}`);
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

  const handleSort = (key: keyof Invoice) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const filteredInvoices = [...invoices]
    .filter(inv => {
      const matchesSearch = 
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const matchesType = typeFilter === 'all' || inv.type === typeFilter;
      
      const invoiceDate = new Date(inv.date).setHours(0, 0, 0, 0);
      const matchesStartDate = !startDate || invoiceDate >= new Date(startDate).setHours(0, 0, 0, 0);
      const matchesEndDate = !endDate || invoiceDate <= new Date(endDate).setHours(23, 59, 59, 999);
      
      return matchesSearch && matchesStatus && matchesType && matchesStartDate && matchesEndDate;
    })
    .sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === undefined || bValue === undefined) return 0;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (sortKey === 'date' || sortKey === 'dueDate' || sortKey === 'createdAt' || sortKey === 'updatedAt') {
        const getDate = (val: any) => {
          if (!val) return new Date(0);
          if (typeof val === 'string') return new Date(val);
          if (val && typeof val === 'object' && val.toDate) return val.toDate();
          if (val && val.seconds) return new Date(val.seconds * 1000);
          return new Date(val);
        };
        
        comparison = getDate(aValue).getTime() - getDate(bValue).getTime();
        
        // Fallback to createdAt for items on the same day for more precise sorting
        if (comparison === 0 && a.createdAt && b.createdAt) {
          comparison = getDate(a.createdAt).getTime() - getDate(b.createdAt).getTime();
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const getSortIcon = (key: keyof Invoice) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-300" />;
    return sortOrder === 'asc' ? 
      <ArrowUp className="w-3 h-3 ml-1 text-[#237227]" /> : 
      <ArrowDown className="w-3 h-3 ml-1 text-[#237227]" />;
  };

  const hasFilters = statusFilter !== 'all' || typeFilter !== 'all' || startDate !== '' || endDate !== '' || searchTerm !== '';

  const resetFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  const getUserName = (p: any) => {
    if (!p) return 'Unknown';
    if (p.displayName && p.displayName !== 'User') return p.displayName;
    if (p.email) return p.email.split('@')[0];
    return 'User';
  };

  const handleCreate = async (invoiceData: Partial<Invoice>) => {
    try {
      if (editingInvoice) {
        await updateItem(editingInvoice.id, invoiceData);
        setEditingInvoice(null);
        toast.success('Invoice updated');
      } else {
        const fullInvoiceData = {
          ...invoiceData,
          createdBy: profile ? {
            uid: profile.uid,
            name: getUserName(profile)
          } : undefined
        };
        const newInvoice = await addItem(fullInvoiceData as Partial<Invoice>);
        
        // Sync the invoice starting number in settings for all users to follow
        if (invoiceData.invoiceNumber) {
          const usedSequence = extractSequence(invoiceData.invoiceNumber);
          const currentStart = settings?.invoiceStartingNumber || 1;
          if (usedSequence >= currentStart) {
            updateSettings({ ...settings, invoiceStartingNumber: usedSequence + 1 });
          }
        }

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

        // Check for E-Way Bill requirement
        if (fullInvoiceData.totalAmount > 100000 && fullInvoiceData.type === 'Tax Invoice') {
          setEwayPromptInvoice(newInvoice as Invoice);
        }
      }
    } catch (err) {
      toast.error('Failed to save invoice');
    }
  };

  const handleConvertToInvoice = async (inv: Invoice) => {
    try {
      const nextNum = generateNextInvoiceNumber(invoices, settings, inv.date);
      await updateItem(inv.id, { 
        type: 'Tax Invoice', 
        status: 'Pending',
        invoiceNumber: nextNum
      });
      
      // Update global sequence
      const usedSequence = extractSequence(nextNum);
      const currentStart = settings?.invoiceStartingNumber || 1;
      if (usedSequence >= currentStart) {
        await updateSettings({ ...settings, invoiceStartingNumber: usedSequence + 1 });
      }

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
    setIsBulkEInvoicing(true);
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

  if ((isCreating || editingInvoice) && settings) {
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
      {ewayPromptInvoice && (
        <Dialog open={!!ewayPromptInvoice} onOpenChange={() => setEwayPromptInvoice(null)}>
          <DialogContent className="sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
            <div className="bg-orange-500 p-6 flex flex-col items-center text-white gap-2">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Truck className="w-6 h-6" />
              </div>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter">E-Way Bill Required?</DialogTitle>
              <DialogDescription className="text-orange-50 font-bold text-center">
                This Tax Invoice exceeds ₹1,00,000 threshold.
              </DialogDescription>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Document Amount</span>
                  <span className="text-slate-900">₹{ewayPromptInvoice.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>GST Threshold</span>
                  <span className="text-orange-600">₹1,00,000</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                As per GST rules, an E-Way bill is mandatory for interstate movement of goods exceeding ₹1,00,000. Would you like to generate the GePP JSON now?
              </p>
            </div>
            <DialogFooter className="p-6 pt-0 flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                className="flex-1 font-black uppercase text-[10px] tracking-widest rounded-xl h-12 border-slate-200"
                onClick={() => setEwayPromptInvoice(null)}
              >
                Skip for now
              </Button>
              <Button 
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl h-12 shadow-lg shadow-orange-100 gap-2"
                onClick={() => {
                  setSelectedIds([ewayPromptInvoice.id]);
                  setIsBulkEInvoicing(true);
                  setEwayPromptInvoice(null);
                }}
              >
                <Zap className="w-4 h-4 fill-current" />
                Generate JSON
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {viewingInvoice && settings && (
        <InvoiceView invoice={viewingInvoice} settings={settings} onClose={() => setViewingInvoice(null)} />
      )}
      {isBulkEInvoicing && settings && (
        <BulkEInvoiceManager 
          selectedInvoices={invoices.filter(inv => selectedIds.includes(inv.id))}
          settings={settings}
          onClose={() => setIsBulkEInvoicing(false)}
          onComplete={() => {
            setSelectedIds([]);
            setIsBulkEInvoicing(false);
          }}
        />
      )}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteItem(deleteId);
            toast.success('Invoice deleted');
            setDeleteId(null);
          }
        }}
        title="Delete Invoice"
        description="Are you sure you want to permanently delete this invoice? This will remove the document and cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
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
                  {canGenerateEInvoice && (
                    <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-orange-600 focus:text-orange-600" onClick={() => handleBulkEInvoice()}>
                      <Zap className="w-4 h-4 fill-orange-600" /> Bulk E-Invoice (IRN)
                    </DropdownMenuItem>
                  )}
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportAudit}
                disabled={isExportingAudit}
                className="hidden sm:flex gap-2 rounded-lg font-bold text-[10px] uppercase tracking-widest h-10 px-5"
              >
                {isExportingAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
        
        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetFilters}
              className="h-10 px-4 rounded-lg bg-red-50 text-red-600 border-red-100 hover:bg-red-100 font-bold text-[10px] uppercase tracking-widest gap-2"
            >
              <X className="w-4 h-4" />
              Reset Filters
            </Button>
          )}
          
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 px-2 rounded-lg border border-slate-200">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date Range</span>
            <Input 
              type="date" 
              className="h-8 w-[130px] border-none bg-transparent text-xs font-bold focus-visible:ring-0 p-0"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-slate-300 mx-1">/</span>
            <Input 
              type="date" 
              className="h-8 w-[130px] border-none bg-transparent text-xs font-bold focus-visible:ring-0 p-0 text-right"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {(startDate || endDate) && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-slate-400 hover:text-red-600 ml-1"
                onClick={() => { setStartDate(''); setEndDate(''); }}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={cn("gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest h-10", (statusFilter !== 'all' || typeFilter !== 'all' || startDate !== '' || endDate !== '') && "text-[#237227] bg-emerald-50 border border-emerald-100")}>
                <Filter className="w-4 h-4" />
                {statusFilter !== 'all' || typeFilter !== 'all' || startDate !== '' || endDate !== '' ? 'Filters Active' : 'Advanced Filters'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl border-slate-100">
            <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b mb-1">Filter by Status</div>
            <DropdownMenuItem onClick={() => setStatusFilter('all')} className={cn("font-bold text-xs uppercase tracking-wider", statusFilter === 'all' && "text-[#237227]")}>All Statuses</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Paid')} className={cn("font-bold text-xs uppercase tracking-wider", statusFilter === 'Paid' && "text-emerald-600")}>Paid</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Pending')} className={cn("font-bold text-xs uppercase tracking-wider", statusFilter === 'Pending' && "text-orange-600")}>Pending</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Draft')} className={cn("font-bold text-xs uppercase tracking-wider", statusFilter === 'Draft' && "text-slate-600")}>Draft</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Cancelled')} className={cn("font-bold text-xs uppercase tracking-wider", statusFilter === 'Cancelled' && "text-rose-600")}>Void</DropdownMenuItem>
            
            <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b my-1">Filter by Type</div>
            <DropdownMenuItem onClick={() => setTypeFilter('all')} className={cn("font-bold text-xs uppercase tracking-wider", typeFilter === 'all' && "text-[#237227]")}>All Types</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTypeFilter('Tax Invoice')} className={cn("font-bold text-xs uppercase tracking-wider", typeFilter === 'Tax Invoice' && "text-[#237227]")}>Tax Invoice</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTypeFilter('Proforma')} className={cn("font-bold text-xs uppercase tracking-wider", typeFilter === 'Proforma' && "text-[#237227]")}>Proforma</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTypeFilter('Delivery Challan')} className={cn("font-bold text-xs uppercase tracking-wider", typeFilter === 'Delivery Challan' && "text-[#237227]")}>Challan</DropdownMenuItem>
            
            {(statusFilter !== 'all' || typeFilter !== 'all' || startDate !== '' || endDate !== '') && (
              <>
                <div className="border-t my-1" />
                <DropdownMenuItem onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setStartDate(''); setEndDate(''); }} className="font-bold text-xs uppercase tracking-wider text-red-600">
                  <X className="w-3 h-3 mr-2" /> Clear All Filters
                </DropdownMenuItem>
              </>
            )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
              <TableHead className="w-[120px] sm:w-[140px]">
                <Button 
                  variant="ghost" 
                  className="font-black text-[10px] uppercase tracking-widest text-slate-400 p-0 hover:bg-transparent hover:text-slate-900 h-auto"
                  onClick={() => handleSort('invoiceNumber')}
                >
                  Doc Number {getSortIcon('invoiceNumber')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="font-black text-[10px] uppercase tracking-widest text-slate-400 p-0 hover:bg-transparent hover:text-slate-900 h-auto"
                  onClick={() => handleSort('clientName')}
                >
                  Client / Customer {getSortIcon('clientName')}
                </Button>
              </TableHead>
              <TableHead className="hidden sm:table-cell text-center">
                <Button 
                  variant="ghost" 
                  className="font-black text-[10px] uppercase tracking-widest text-slate-400 p-0 hover:bg-transparent hover:text-slate-900 h-auto mx-auto"
                  onClick={() => handleSort('type')}
                >
                  Type {getSortIcon('type')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button 
                  variant="ghost" 
                  className="font-black text-[10px] uppercase tracking-widest text-slate-400 p-0 hover:bg-transparent hover:text-slate-900 h-auto mx-auto"
                  onClick={() => handleSort('status')}
                >
                  Status {getSortIcon('status')}
                </Button>
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                <Button 
                  variant="ghost" 
                  className="font-black text-[10px] uppercase tracking-widest text-slate-400 p-0 hover:bg-transparent hover:text-slate-900 h-auto"
                  onClick={() => handleSort('date')}
                >
                  Issue Date {getSortIcon('date')}
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell font-black text-[10px] uppercase tracking-widest text-slate-400">Created By</TableHead>
              <TableHead className="hidden xl:table-cell">
                <Button 
                  variant="ghost" 
                  className="font-black text-[10px] uppercase tracking-widest text-slate-400 p-0 hover:bg-transparent hover:text-slate-900 h-auto"
                  onClick={() => handleSort('dueDate')}
                >
                  Due Date {getSortIcon('dueDate')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  className="font-black text-[10px] uppercase tracking-widest text-slate-400 p-0 hover:bg-transparent hover:text-slate-900 h-auto ml-auto"
                  onClick={() => handleSort('totalAmount')}
                >
                  Amount {getSortIcon('totalAmount')}
                </Button>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-20">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing with server...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-20 text-slate-400 italic text-sm">No records matching your search</TableCell>
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
                <TableCell className="font-mono font-bold text-slate-900 border-l-4 border-transparent group-hover:border-[#237227] transition-all text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    {inv.invoiceNumber}
                    {inv.ewayBillNo && (
                      <span title={`EWB: ${inv.ewayBillNo}`}>
                        <Truck className="w-3 h-3 text-blue-600" />
                      </span>
                    )}
                    {inv.irn && (
                      <span title="E-Invoice Registered">
                        <FileCheck2 className="w-3 h-3 text-indigo-600" />
                      </span>
                    )}
                  </div>
                </TableCell>
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
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {inv.createdBy?.name?.charAt(0) || '?'}
                    </div>
                    <span className="text-xs font-medium text-slate-600 truncate max-w-[80px]">{inv.createdBy?.name || 'Unknown'}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden xl:table-cell text-slate-500 text-xs font-bold tabular-nums">
                  {inv.dueDate ? format(new Date(inv.dueDate), 'dd MMM yyyy') : '-'}
                </TableCell>
                <TableCell className="text-right font-black text-xs sm:text-sm font-mono text-slate-900 whitespace-nowrap">
                  <div className="flex flex-col items-end gap-1">
                    {formatCurrency(inv.totalAmount, inv.currency)}
                    {inv.status !== 'Paid' && (
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0 text-[#237227] font-black text-[10px] uppercase tracking-widest flex items-center gap-1 group"
                        onClick={() => handlePayNow(inv)}
                      >
                        <CreditCard className="w-3 h-3 transition-transform group-hover:scale-110" />
                        Pay Online
                      </Button>
                    )}
                  </div>
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
                          <CreditCard className="w-4 h-4" />
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
                      {(canDelete || isBilling) && (
                        <DropdownMenuItem className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => setDeleteId(inv.id)}>
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
