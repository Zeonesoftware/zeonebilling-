import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  ShoppingCart,
  Calendar,
  Save,
  ChevronDown
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Purchase, Item, InvoiceItem } from '@/types';
import { useData } from '@/hooks/useData';
import { format } from 'date-fns';

interface PurchaseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Purchase>) => Promise<void>;
  initialData?: Purchase | null;
}

export function PurchaseForm({ isOpen, onClose, onSave, initialData }: PurchaseFormProps) {
  const { data: products } = useData<Item>('items');
  const [formData, setFormData] = useState<Partial<Purchase>>({
    purchaseNumber: '', // This will be "Invoice Number" in UI
    date: format(new Date(), 'yyyy-MM-dd'),
    supplierName: '',
    supplierGstin: '',
    status: 'Pending',
    notes: '',
    items: [],
    subtotal: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
    totalAmount: 0
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        purchaseNumber: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        supplierName: '',
        supplierGstin: '',
        status: 'Pending',
        notes: '',
        items: [{
          itemId: '',
          name: '',
          hsn: '',
          quantity: 1,
          price: 0,
          gstRate: 18,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: 0
        }],
        subtotal: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        totalAmount: 0
      });
    }
  }, [initialData, isOpen]);

  const calculateTotals = (items: InvoiceItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const totalTax = items.reduce((sum, item) => sum + (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0), 0);
    const totalAmount = subtotal + totalTax;

    return { 
      subtotal, 
      totalCgst: items.reduce((sum, item) => sum + (item.cgst || 0), 0),
      totalSgst: items.reduce((sum, item) => sum + (item.sgst || 0), 0),
      totalIgst: items.reduce((sum, item) => sum + (item.igst || 0), 0),
      totalAmount 
    };
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      itemId: '',
      name: '',
      hsn: '',
      quantity: 1,
      price: 0,
      gstRate: 18,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 0
    };
    const newItems = [...(formData.items || []), newItem];
    setFormData({ ...formData, items: newItems, ...calculateTotals(newItems) });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...(formData.items || [])];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems, ...calculateTotals(newItems) });
  };

  const handleUpdateItem = (index: number, updates: Partial<InvoiceItem>) => {
    const newItems = [...(formData.items || [])];
    const item = { ...newItems[index], ...updates };

    const lineSubtotal = item.quantity * item.price;
    // Simple logic for tax split (standard 50/50 for CGST/SGST)
    item.cgst = (lineSubtotal * (item.gstRate / 2)) / 100;
    item.sgst = (lineSubtotal * (item.gstRate / 2)) / 100;
    item.igst = 0;
    item.total = lineSubtotal + item.cgst + item.sgst + item.igst;
    
    newItems[index] = item;
    setFormData({ ...formData, items: newItems, ...calculateTotals(newItems) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierName) return;
    if (!formData.items || formData.items.length === 0) return;

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const labelStyles = "text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block";
  const inputStyles = "h-11 rounded-lg border-slate-200 bg-white focus:ring-blue-500 focus:border-blue-500 transition-all";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 border-none bg-white rounded-[24px] shadow-2xl overflow-hidden">
        <DialogHeader className="px-8 py-6 flex-row items-center justify-between space-y-0 border-b border-slate-50">
          <DialogTitle className="text-xl font-bold text-slate-800">
            {initialData ? 'Edit Purchase Bill' : 'Add Purchase Bill'}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 text-slate-400 hover:bg-slate-50 transition-colors">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-0">
          <div className="px-8 py-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Header Fields Section */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Date *</Label>
                <Input 
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="h-11 border-slate-200 bg-white focus:ring-1 focus:ring-slate-400 rounded-xl transition-shadow"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Payment Status</Label>
                <Select 
                  value={formData.status === 'Paid' ? 'Paid' : 'Unpaid'} 
                  onValueChange={(v: any) => setFormData({ ...formData, status: v === 'Paid' ? 'Paid' : 'Pending' })}
                >
                  <SelectTrigger className="h-11 border-slate-200 bg-white focus:ring-1 focus:ring-slate-400 rounded-xl">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Supplier Name *</Label>
                <Input 
                  value={formData.supplierName}
                  onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                  className="h-11 border-slate-200 bg-white focus:ring-1 focus:ring-slate-400 rounded-xl transition-shadow"
                  placeholder="Vendor / Supplier name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Supplier GSTIN</Label>
                <Input 
                  value={formData.supplierGstin}
                  onChange={e => setFormData({ ...formData, supplierGstin: e.target.value })}
                  className="h-11 border-slate-200 bg-white focus:ring-1 focus:ring-slate-400 rounded-xl transition-shadow"
                  placeholder="15-digit GSTIN"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Invoice Number *</Label>
                <Input 
                  value={formData.purchaseNumber}
                  onChange={e => setFormData({ ...formData, purchaseNumber: e.target.value })}
                  className="h-11 border-slate-200 bg-white focus:ring-1 focus:ring-slate-400 rounded-xl transition-shadow"
                  placeholder="Supplier invoice no."
                  required
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Note (Optional)</Label>
                <Input 
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="h-11 border-slate-200 bg-white focus:ring-1 focus:ring-slate-400 rounded-xl transition-shadow"
                  placeholder="Any note..."
                />
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-4 pt-6 border-t border-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1 h-4 bg-slate-900 rounded-full"></span>
                Items
              </h3>
              
              <div className="grid grid-cols-12 gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                <div className="col-span-4">Name</div>
                <div className="col-span-2">HSN</div>
                <div className="col-span-1 text-center">Qty</div>
                <div className="col-span-2">Rate</div>
                <div className="col-span-2">Tax %</div>
                <div className="col-span-1"></div>
              </div>

              <div className="space-y-4">
                {(formData.items || []).map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-start animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="col-span-4">
                      <Input 
                        value={item.name}
                        onChange={e => handleUpdateItem(index, { name: e.target.value })}
                        className="h-10 border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-400"
                        placeholder="Item name"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        value={item.hsn}
                        onChange={e => handleUpdateItem(index, { hsn: e.target.value })}
                        className="h-10 border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-400"
                        placeholder="HSN"
                      />
                    </div>
                    <div className="col-span-1">
                      <Input 
                        type="number"
                        value={item.quantity}
                        onChange={e => handleUpdateItem(index, { quantity: Number(e.target.value) })}
                        className="h-10 border-slate-200 rounded-xl text-xs text-center focus:ring-1 focus:ring-slate-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        type="number"
                        value={item.price}
                        onChange={e => handleUpdateItem(index, { price: Number(e.target.value) })}
                        className="h-10 border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <Select 
                        value={item.gstRate.toString()} 
                        onValueChange={(v) => handleUpdateItem(index, { gstRate: Number(v) })}
                      >
                        <SelectTrigger className="h-10 border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-400">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="5">5%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                          <SelectItem value="18">18%</SelectItem>
                          <SelectItem value="28">28%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveItem(index)}
                        className="h-10 w-10 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addItem}
                className="h-9 px-4 gap-2 border-slate-200 text-slate-600 font-bold rounded-xl text-xs bg-white hover:bg-slate-50 transition-all shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>

            {/* Sumary Totals Row */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-50">
              <div className="flex gap-8">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Taxable</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">₹{formData.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tax</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">₹{(formData.totalAmount! - formData.subtotal!).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Grand Total</span>
                <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">₹{formData.totalAmount?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 px-8 py-6 flex items-center justify-end gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="h-12 px-10 rounded-2xl font-bold border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 transition-all text-sm"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={saving || !formData.supplierName || !formData.items?.length}
              className="h-12 px-10 rounded-2xl font-bold bg-black hover:bg-slate-900 text-white shadow-xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : 'Save Purchase'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
