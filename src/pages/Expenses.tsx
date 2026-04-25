import React, { useState } from 'react';
import { useData } from '@/hooks/useData';
import { useRBAC } from '@/hooks/useRBAC';
import { Expense } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ReceiptIndianRupee, Sparkles, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';

export default function Expenses() {
  const { canCreate, canEdit, canDelete } = useRBAC();
  const { data: expenses, loading, addItem, updateItem, deleteItem } = useData<Expense>('expenses');
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

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
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} expenses?`)) return;

    try {
      setIsBulkUpdating(true);
      const loadingToast = toast.loading(`Deleting ${selectedIds.length} expenses...`);
      
      for (const id of selectedIds) {
        await deleteItem(id);
      }

      toast.dismiss(loadingToast);
      toast.success('Bulk delete complete');
      setSelectedIds([]);
    } catch (err) {
      toast.error('Bulk delete failed');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkUpdateITC = async (status: boolean) => {
    try {
      setIsBulkUpdating(true);
      const loadingToast = toast.loading(`Updating ${selectedIds.length} expenses...`);
      
      await Promise.all(selectedIds.map(id => updateItem(id, { itcClaimed: status })));

      toast.dismiss(loadingToast);
      toast.success('Bulk update complete');
      setSelectedIds([]);
    } catch (err) {
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
        <div className="bg-slate-900 text-white rounded-lg p-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top-4">
          <div className="flex items-center gap-4 pl-4">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FFAA00] text-black text-[10px] font-black">
              {selectedIds.length}
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">Selected</span>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 gap-2 text-white hover:bg-white/10 font-bold text-[10px] uppercase tracking-widest"
                  onClick={() => handleBulkUpdateITC(true)}
                  disabled={isBulkUpdating}
                >
                  <CheckCircle2 className="w-3 h-3" /> Mark ITC
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 gap-2 text-white hover:bg-white/10 font-bold text-[10px] uppercase tracking-widest"
                  onClick={() => handleBulkUpdateITC(false)}
                  disabled={isBulkUpdating}
                >
                  <XCircle className="w-3 h-3" /> Unmark ITC
                </Button>
                <div className="w-px h-4 bg-white/20 mx-2" />
              </>
            )}
            {canDelete && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-2 text-red-400 hover:text-red-300 hover:bg-red-950/20 font-bold text-[10px] uppercase tracking-widest"
                onClick={handleBulkDelete}
                disabled={isBulkUpdating}
              >
                <Trash2 className="w-3 h-3" /> Delete Selected
              </Button>
            )}
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

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-[#FAFAFA]">
            <TableRow>
              <TableHead className="w-[40px] px-4">
                <Checkbox 
                  checked={selectedIds.length === expenses.length && expenses.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase">Date</TableHead>
              <TableHead className="font-mono text-[10px] uppercase">Description</TableHead>
              <TableHead className="font-mono text-[10px] uppercase">Category</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-right">Amount</TableHead>
              <TableHead className="font-mono text-[10px] uppercase text-center">ITC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12">Loading...</TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12">No expenses recorded</TableCell></TableRow>
            ) : expenses.map((exp) => (
              <TableRow key={exp.id} className={cn(selectedIds.includes(exp.id) && "bg-slate-50")}>
                <TableCell className="px-4">
                  <Checkbox 
                    checked={selectedIds.includes(exp.id)}
                    onCheckedChange={() => toggleSelect(exp.id)}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">{exp.date}</TableCell>
                <TableCell className="font-medium">{exp.description}</TableCell>
                <TableCell><Badge variant="secondary" className="font-normal">{exp.category}</Badge></TableCell>
                <TableCell className="text-right font-bold tabular-nums">₹{exp.amount.toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  {exp.itcClaimed ? <Badge className="bg-blue-100 text-blue-700">YES</Badge> : <Badge variant="outline">NO</Badge>}
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
    </div>
  );
}
