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
import { ScrollArea } from '@/components/ui/scroll-area';

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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Purchase Bill' : 'Add Purchase Bill'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh] px-1">
          <form onSubmit={handleSubmit} className="space-y-6 py-4 pr-3">
            {/* Header Fields Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs uppercase font-bold text-[#666666]">Date *</Label>
                <Input 
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs uppercase font-bold text-[#666666]">Status</Label>
                <Select 
                  value={formData.status === 'Paid' ? 'Paid' : 'Unpaid'} 
                  onValueChange={(v: any) => setFormData({ ...formData, status: v === 'Paid' ? 'Paid' : 'Pending' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs uppercase font-bold text-[#666666]">Supplier Name *</Label>
              <Input 
                value={formData.supplierName}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                placeholder="Vendor / Supplier name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-xs uppercase font-bold text-[#666666]">Supplier GSTIN</Label>
                <Input 
                  value={formData.supplierGstin}
                  onChange={e => setFormData({ ...formData, supplierGstin: e.target.value })}
                  placeholder="15-digit GSTIN"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs uppercase font-bold text-[#666666]">Invoice Number *</Label>
                <Input 
                  value={formData.purchaseNumber}
                  onChange={e => setFormData({ ...formData, purchaseNumber: e.target.value })}
                  placeholder="Supplier invoice no."
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs uppercase font-bold text-[#666666]">Note (Optional)</Label>
              <Input 
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any note..."
              />
            </div>

            {/* Items Section */}
            <div className="space-y-4 pt-4 border-t border-[#F0F0F0]">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#666666]">Bill Items</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addItem}
                  className="h-8 text-[10px] uppercase font-bold tracking-widest"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              
              <div className="space-y-4">
                {(formData.items || []).map((item, index) => (
                  <div key={index} className="p-3 rounded-lg border border-slate-100 space-y-3 relative">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveItem(index)}
                      className="absolute top-2 right-2 h-6 w-6 text-slate-300 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>

                    <div className="grid gap-2">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Item Name</Label>
                      <Input 
                        value={item.name}
                        onChange={e => handleUpdateItem(index, { name: e.target.value })}
                        className="h-8 text-xs"
                        placeholder="Item name"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="grid gap-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">HSN</Label>
                        <Input 
                          value={item.hsn}
                          onChange={e => handleUpdateItem(index, { hsn: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Qty</Label>
                        <Input 
                          type="number"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={e => handleUpdateItem(index, { quantity: Number(e.target.value) })}
                          className="h-8 text-center text-xs"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Rate</Label>
                        <Input 
                          type="number"
                          value={item.price === 0 ? '' : item.price}
                          onChange={e => handleUpdateItem(index, { price: Number(e.target.value) })}
                          className="h-8 text-xs text-right"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">GST %</Label>
                        <Select 
                          value={item.gstRate.toString()} 
                          onValueChange={(v) => handleUpdateItem(index, { gstRate: Number(v) })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="28">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Totals */}
            <div className="p-4 rounded-lg bg-slate-50 space-y-2">
              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                <span>Taxable Amount</span>
                <span>₹{formData.subtotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                <span>GST Amount</span>
                <span>₹{(formData.totalAmount! - formData.subtotal!).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
                <span>Total Bill</span>
                <span>₹{formData.totalAmount?.toLocaleString()}</span>
              </div>
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t border-[#F0F0F0]">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={saving || !formData.supplierName || !formData.items?.length}
            className="bg-black text-white hover:bg-black/90"
          >
            {saving ? 'Saving...' : 'Save Purchase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
