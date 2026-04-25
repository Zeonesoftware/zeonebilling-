import React, { useState } from 'react';
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
  Loader2,
  X,
  CreditCard,
  ShoppingCart
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
import { useData } from '@/hooks/useData';
import { useRBAC } from '@/hooks/useRBAC';
import { Purchase } from '@/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/invoice-utils';
import { PurchaseForm } from '@/components/purchases/PurchaseForm';

export default function Purchases() {
  const { canCreate, canEdit, canDelete } = useRBAC();
  const { data: purchases, loading, addItem, updateItem, deleteItem } = useData<Purchase>('purchases');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  
  const filteredPurchases = purchases.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).filter(p => 
    p.purchaseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async (data: Partial<Purchase>) => {
    try {
      if (editingPurchase) {
        await updateItem(editingPurchase.id, data);
        toast.success('Purchase order updated');
      } else {
        await addItem(data);
        toast.success('New purchase order created');
      }
      setIsFormOpen(false);
      setEditingPurchase(null);
    } catch (err) {
      toast.error('Failed to save purchase');
    }
  };

  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this purchase record?')) {
      try {
        await deleteItem(id);
        toast.success('Purchase record deleted');
      } catch (err) {
        toast.error('Failed to delete record');
      }
    }
  };

  const getStatusBadge = (purchase: Purchase) => {
    switch (purchase.status) {
      case 'Paid':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold uppercase text-[10px] tracking-widest px-3 py-1 rounded-full">Paid</Badge>;
      case 'Pending':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-100 font-bold uppercase text-[10px] tracking-widest px-3 py-1 rounded-full">Unpaid</Badge>;
      case 'Cancelled':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-100 font-bold uppercase text-[10px] tracking-widest px-3 py-1 rounded-full">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="font-bold uppercase text-[10px] tracking-widest px-3 py-1 rounded-full border-slate-200 text-slate-400">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Purchase History</h2>
          <p className="text-slate-500 text-sm font-medium">Manage and track your inventory purchase bills</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button 
              size="sm" 
              className="gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold text-[10px] uppercase tracking-widest h-10 px-5 shadow-lg shadow-blue-600/20"
              onClick={() => {
                setEditingPurchase(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Add Purchase Bill
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search purchases or suppliers..." 
            className="pl-10 border-slate-200 focus-visible:ring-blue-600 h-10 text-sm rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="ghost" size="sm" className="gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
          <Filter className="w-4 h-4" />
          More Filters
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-transparent border-slate-200">
              <TableHead className="w-[140px] font-black text-[10px] uppercase tracking-widest text-slate-400">Invoice Number</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Supplier</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center text-slate-400">Status</TableHead>
              <TableHead className="hidden lg:table-cell font-black text-[10px] uppercase tracking-widest text-slate-400">Date</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right text-slate-400">Total Amount</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing purchases...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPurchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                        <ShoppingCart className="w-16 h-16 opacity-20" />
                        <p className="italic text-sm text-slate-400">No purchase records found</p>
                        {canCreate && (
                            <Button 
                                variant="outline" 
                                className="font-black text-[10px] uppercase tracking-widest border-2"
                                onClick={() => setIsFormOpen(true)}
                            >
                                <Plus className="w-3 h-3 mr-2" /> Add your first purchase
                            </Button>
                        )}
                    </div>
                </TableCell>
              </TableRow>
            ) : filteredPurchases.map((p) => (
              <TableRow key={p.id} className="hover:bg-slate-50 transition-colors group border-slate-100">
                <TableCell className="font-mono font-bold text-slate-900 border-l-4 border-transparent group-hover:border-blue-600 transition-all text-xs sm:text-sm">{p.purchaseNumber}</TableCell>
                <TableCell>
                  <div className="font-black text-slate-900 text-xs sm:text-sm">{p.supplierName}</div>
                  <div className="text-[10px] font-mono text-slate-400 font-bold uppercase">{p.supplierGstin || 'NO GSTIN'}</div>
                </TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(p)}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-slate-500 text-xs font-bold tabular-nums">
                  {format(new Date(p.date), 'dd MMM yyyy')}
                </TableCell>
                <TableCell className="text-right font-black text-xs sm:text-sm font-mono text-slate-900">
                  {formatCurrency(p.totalAmount, 'INR')}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-full")}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl border-slate-100">
                      <DropdownMenuItem 
                        className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider"
                        onClick={() => handleEdit(p)}
                      >
                        <Eye className="w-4 h-4 text-blue-600" /> View & Edit
                      </DropdownMenuItem>
                      {canEdit && (
                        <DropdownMenuItem 
                          className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-amber-600"
                          onClick={() => handleEdit(p)}
                        >
                          <FileEdit className="w-4 h-4" /> Quick Edit
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem 
                          className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider text-red-600 focus:text-red-600 focus:bg-red-50" 
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 className="w-4 h-4" /> Delete Record
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

      <PurchaseForm 
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingPurchase(null);
        }}
        onSave={handleSave}
        initialData={editingPurchase}
      />
    </div>
  );
}
