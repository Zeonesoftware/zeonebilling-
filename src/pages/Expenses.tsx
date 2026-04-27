import React, { useState } from 'react';
import { useData } from '@/hooks/useData';
import { useRBAC } from '@/hooks/useRBAC';
import { Expense } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, 
  ReceiptIndianRupee, 
  Sparkles, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  MoreHorizontal,
  ChevronDown,
  Tag,
  Check,
  Loader2,
  Search,
  Filter
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const CATEGORIES = [
  'Inventory', 'Travel', 'Rent', 'Utilities', 'Marketing', 
  'Legal', 'Softwares', 'Office Supplies', 'Meals', 'Misc'
];

export default function Expenses() {
  const { profile } = useAuth();
  const { canCreate, canEdit, canDelete } = useRBAC();
  const { data: expenses, loading, addItem, updateItem, deleteItem } = useData<Expense>('expenses');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  const handleCreate = async (data: Partial<Expense>) => {
    try {
      await addItem(data);
      setIsFormOpen(false);
      toast.success('Expense logged');
    } catch (err) {
      toast.error('Failed to log expense');
    }
  };

  const handleAiCategorize = async () => {
    const uncategorized = expenses.filter(e => !e.category || e.category === 'Misc');
    if (uncategorized.length === 0) return toast.info('All expenses are already categorized!');

    setIsAiLoading(true);
    toast.promise(
      Promise.all(uncategorized.map(async (exp) => {
        const res = await fetch('/api/ai/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: exp.description })
        });
        const { category } = await res.json();
        await updateItem(exp.id, { category });
      })),
      {
        loading: 'AI is analyzing your spending patterns...',
        success: 'Expenses categorized successfully!',
        error: 'AI categorization failed'
      }
    );
    setIsAiLoading(false);
  };

  const handleBulkDelete = async () => {
    try {
      setIsBulkUpdating(true);
      const loadingToast = toast.loading(`Deleting ${selectedIds.length} expenses...`);
      
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'expenses', id));
      });
      
      await batch.commit();

      toast.dismiss(loadingToast);
      toast.success('Bulk delete complete');
      setSelectedIds([]);
      setIsBulkDeleteConfirmOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Bulk delete failed');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkUpdateITC = async (status: boolean) => {
    try {
      setIsBulkUpdating(true);
      const loadingToast = toast.loading(`${status ? 'Marking' : 'Unmarking'} ITC status for ${selectedIds.length} items...`);
      
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'expenses', id), { 
          itcClaimed: status,
          updatedAt: new Date().toISOString(),
          updatedBy: profile?.uid
        });
      });
      
      await batch.commit();

      toast.dismiss(loadingToast);
      toast.success('Selected expenses updated');
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      toast.error('Bulk update failed');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkUpdateCategory = async (category: string) => {
    try {
      setIsBulkUpdating(true);
      const loadingToast = toast.loading(`Updating category to ${category}...`);
      
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'expenses', id), { 
          category,
          updatedAt: new Date().toISOString(),
          updatedBy: profile?.uid
        });
      });
      
      await batch.commit();

      toast.dismiss(loadingToast);
      toast.success('Categories updated');
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      toast.error('Bulk update failed');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === expenses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(expenses.map(exp => exp.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredExpenses = expenses
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .filter(exp => {
    const matchesSearch = 
      exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Expense Tracker</h2>
          <p className="text-[#666666] text-sm serif italic">Monitor overheads and claim ITC</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2" 
              onClick={handleAiCategorize}
              disabled={isAiLoading}
            >
              <Sparkles className={cn("w-4 h-4 text-purple-500", isAiLoading && "animate-pulse")} /> 
              {isAiLoading ? 'Analyzing...' : 'AI Categorize'}
            </Button>
          )}
          {canCreate && (
            <Button size="sm" className="bg-black text-white gap-2" onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4" /> Log Expense
            </Button>
          )}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white rounded-xl p-3 flex flex-wrap items-center justify-between shadow-2xl animate-in slide-in-from-top-4 sticky top-4 z-50 ring-4 ring-slate-900/10">
          <div className="flex items-center gap-4 pl-4 mr-4">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FFAA00] text-black text-[10px] font-black">
              {selectedIds.length}
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">Expenses Selected</span>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 gap-2 text-white hover:bg-white/10 font-bold text-[10px] uppercase tracking-widest"
                      disabled={isBulkUpdating}
                    >
                      <CheckCircle2 className="w-3 h-3 text-blue-400" /> ITC Status <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-500">Bulk Update ITC</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-3 py-3" onClick={() => handleBulkUpdateITC(true)}>
                      <CheckCircle2 className="w-4 h-4 text-blue-500" /> Mark as Claimed
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-3 py-3" onClick={() => handleBulkUpdateITC(false)}>
                      <XCircle className="w-4 h-4 text-slate-400" /> Mark as Not Claimed
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 gap-2 text-white hover:bg-white/10 font-bold text-[10px] uppercase tracking-widest"
                      disabled={isBulkUpdating}
                    >
                      <Tag className="w-3 h-3 text-purple-400" /> Category <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 h-64 overflow-auto">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-500">Set Category</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {CATEGORIES.map(cat => (
                      <DropdownMenuItem key={cat} className="gap-3 py-2.5" onClick={() => handleBulkUpdateCategory(cat)}>
                        {cat}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-4 bg-white/20 mx-2" />
              </>
            )}
            {canDelete && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-2 text-red-400 hover:text-red-300 hover:bg-red-950/20 font-bold text-[10px] uppercase tracking-widest"
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                disabled={isBulkUpdating}
              >
                <Trash2 className="w-3 h-3" /> Delete
              </Button>
            )}
            
            <div className="w-px h-4 bg-white/20 mx-2" />
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-white/10 text-white/50"
              onClick={() => setSelectedIds([])}
            >
              <XCircle className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search expenses..." 
              className="pl-10 border-slate-200 focus-visible:ring-black h-10 text-sm rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={cn("gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest", categoryFilter !== 'all' && "text-blue-600 bg-blue-50")}>
                <Filter className="w-4 h-4" />
                {categoryFilter !== 'all' ? 'Category: ' + categoryFilter : 'Filters'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl border-slate-100 shadow-2xl max-h-64 overflow-auto">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Filter Category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCategoryFilter('all')} className={cn("font-bold text-xs uppercase tracking-wider", categoryFilter === 'all' && "text-blue-600")}>All Categories</DropdownMenuItem>
              {CATEGORIES.map(cat => (
                <DropdownMenuItem key={cat} onClick={() => setCategoryFilter(cat)} className={cn("font-bold text-xs uppercase tracking-wider", categoryFilter === cat && "text-blue-600")}>
                  {cat}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Table>
          <TableHeader className="bg-[#FAFAFA]">
            <TableRow>
              <TableHead className="w-[50px] px-4">
                <Checkbox 
                  checked={selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0}
                  onCheckedChange={toggleSelectAll}
                  className="translate-y-[2px]"
                />
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase">Date</TableHead>
              <TableHead className="font-mono text-[10px] uppercase">Description</TableHead>
              <TableHead className="font-mono text-[10px] uppercase">Category</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-right">Amount</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-center">ITC Claimed</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading expenses...</TableCell></TableRow>
            ) : filteredExpenses.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400">No expenses found.</TableCell></TableRow>
            ) : filteredExpenses.map((exp) => (
              <TableRow 
                key={exp.id} 
                className={cn(
                  "transition-colors group",
                  selectedIds.includes(exp.id) ? "bg-blue-50/50" : "hover:bg-slate-50"
                )}
              >
                <TableCell className="px-4">
                  <Checkbox 
                    checked={selectedIds.includes(exp.id)}
                    onCheckedChange={() => toggleSelect(exp.id)}
                    className="translate-y-[2px]"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums text-slate-500">{exp.date}</TableCell>
                <TableCell className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{exp.description}</TableCell>
                <TableCell><Badge variant="secondary" className="font-normal border-slate-100 bg-slate-50 text-slate-600">{exp.category}</Badge></TableCell>
                <TableCell className="text-right font-black tabular-nums text-slate-900">₹{exp.amount.toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  {exp.itcClaimed ? (
                    <div className="flex items-center justify-center gap-1.5 text-blue-600 font-black text-[10px]">
                      <Check className="w-3.5 h-3.5" /> CLAIMED
                    </div>
                  ) : (
                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Pending</div>
                  )}
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    onClick={() => setDeleteId(exp.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ExpenseForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSave={handleCreate} 
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteItem(deleteId);
            toast.success('Expense deleted');
            setDeleteId(null);
          }
        }}
        title="Delete Expense"
        description="Are you sure you want to permanently delete this expense? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />

      <ConfirmDialog
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title="Bulk Delete Expenses"
        description={`Are you sure you want to delete ${selectedIds.length} selected expenses? This action will permanently remove all selected records.`}
        confirmText="Delete All"
        variant="destructive"
      />
    </div>
  );
}
