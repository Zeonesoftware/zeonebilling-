import React, { useState } from 'react';
import { Expense } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Partial<Expense>) => void;
}

const CATEGORIES = [
  'Inventory', 'Travel', 'Rent', 'Utilities', 'Marketing', 
  'Legal', 'Softwares', 'Office Supplies', 'Meals', 'Misc'
];

export function ExpenseForm({ isOpen, onClose, onSave }: ExpenseFormProps) {
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [formData, setFormData] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    category: 'Misc',
    itcClaimed: false
  });

  const handleCategorize = async () => {
    if (!formData.description) {
      toast.error('Enter a description first');
      return;
    }

    try {
      setIsCategorizing(true);
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: formData.description })
      });
      const data = await res.json();
      if (data.category) {
        setFormData(prev => ({ ...prev, category: data.category }));
        toast.success(`Categorized as ${data.category}`);
      }
    } catch (err) {
      toast.error('AI categorization failed');
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Business Expense</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs uppercase font-bold text-[#666666]">Description</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-[10px] gap-1 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                onClick={handleCategorize}
                disabled={isCategorizing}
              >
                {isCategorizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI Categorize
              </Button>
            </div>
            <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="e.g. Server Hosting" />
          </div>
          
          <div className="grid gap-2">
            <Label className="text-xs uppercase font-bold text-[#666666]">Category</Label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs uppercase font-bold text-[#666666]">Date</Label>
              <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs uppercase font-bold text-[#666666]">Amount (₹)</Label>
              <Input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="itc" 
              checked={formData.itcClaimed} 
              onCheckedChange={(checked) => setFormData({ ...formData, itcClaimed: !!checked })}
            />
            <Label htmlFor="itc" className="text-sm cursor-pointer font-medium">Claim Input Tax Credit (ITC)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-black text-white hover:bg-black/90">Save Expense</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
