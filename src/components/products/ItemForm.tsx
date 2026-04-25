import React, { useState } from 'react';
import { Item } from '@/types';
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
import { ScrollArea } from '@/components/ui/scroll-area';

interface ItemFormProps {
  item?: Item | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<Item>) => void;
}

export function ItemForm({ item, isOpen, onClose, onSave }: ItemFormProps) {
  const [formData, setFormData] = useState<Partial<Item>>(item || {
    name: '',
    category: 'General',
    hsn: '',
    price: 0,
    gstRate: 18,
    stock: 0,
    unit: 'Unit',
    barcode: '',
    description: ''
  });

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh] px-1">
          <div className="grid gap-4 py-4 pr-3">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-xs uppercase font-bold text-[#666666]">Product Name</Label>
              <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category" className="text-xs uppercase font-bold text-[#666666]">Category</Label>
                <Input id="category" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit" className="text-xs uppercase font-bold text-[#666666]">Unit</Label>
                <Input id="unit" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hsn" className="text-xs uppercase font-bold text-[#666666]">HSN/SAC</Label>
                <Input id="hsn" value={formData.hsn} onChange={e => setFormData({ ...formData, hsn: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="barcode" className="text-xs uppercase font-bold text-[#666666]">Barcode</Label>
                <Input id="barcode" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price" className="text-xs uppercase font-bold text-[#666666]">Price (₹)</Label>
                <Input id="price" type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gstRate" className="text-xs uppercase font-bold text-[#666666]">GST (%)</Label>
                <Input id="gstRate" type="number" value={formData.gstRate} onChange={e => setFormData({ ...formData, gstRate: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock" className="text-xs uppercase font-bold text-[#666666]">Stock</Label>
                <Input id="stock" type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-xs uppercase font-bold text-[#666666]">Description</Label>
              <Input id="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t border-[#F0F0F0]">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-black text-white hover:bg-black/90">Save Product</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
