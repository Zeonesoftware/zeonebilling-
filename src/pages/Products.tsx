import React, { useState, useRef } from 'react';
import { useData, useSettings } from '@/hooks/useData';
import { useRBAC } from '@/hooks/useRBAC';
import { Item } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Package, MoreHorizontal, FileEdit, Trash2, Upload, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ItemForm } from '@/components/products/ItemForm';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';

export default function Products() {
  const { canCreate, canEdit, canDelete } = useRBAC();
  const { data: items, loading, addItem, updateItem, deleteItem } = useData<Item>('items');
  const { settings } = useSettings();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStockValue, setBulkStockValue] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const threshold = settings?.lowStockThreshold || 10;
  const lowStockItems = items.filter(i => i.stock < threshold);

  const categories = ['All', ...Array.from(new Set(items.map(i => i.category || 'General')))];

  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.hsn.includes(searchTerm);
    
    const matchesCategory = selectedCategory === 'All' || (i.category || 'General') === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const loadingToast = toast.loading(`Importing ${results.data.length} products...`);
          const importedData = results.data.map((row: any) => ({
            name: row.name || 'Unnamed Product',
            hsn: row.hsn || '',
            price: Number(row.price) || 0,
            gstRate: Number(row.gstRate) || 18,
            stock: Number(row.stock) || 0,
            unit: row.unit || 'Unit',
            category: row.category || 'General',
            description: row.description || ''
          }));

          // Send to bulk endpoint
          const res = await fetch('/api/data/items', {
            method: 'GET'
          });
          const existingItems = await res.json();
          
          const combined = [...existingItems];
          for (const item of importedData) {
            combined.push({ ...item, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) });
          }

          await fetch('/api/data/items/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(combined)
          });

          toast.dismiss(loadingToast);
          toast.success('Import successful');
          window.location.reload();
        } catch (err) {
          toast.error('Import failed');
        }
      }
    });
  };

  const handleSave = async (data: Partial<Item>) => {
    try {
      if (editingItem) {
        await updateItem(editingItem.id, data);
        toast.success('Product updated');
      } else {
        await addItem(data);
        toast.success('Product added');
      }
      setIsFormOpen(false);
      setEditingItem(null);
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  const handleBulkStockUpdate = async () => {
    const value = parseInt(bulkStockValue);
    if (isNaN(value)) return toast.error('Invalid stock value');

    try {
      setIsBulkUpdating(true);
      const loadingToast = toast.loading(`Updating stock for ${selectedIds.length} items...`);
      
      for (const id of selectedIds) {
        const item = items.find(i => i.id === id);
        if (item) {
          await updateItem(id, { stock: item.stock + value });
        }
      }

      toast.dismiss(loadingToast);
      toast.success('Bulk update complete');
      setSelectedIds([]);
      setBulkStockValue('');
    } catch (err) {
      toast.error('Bulk update failed');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;

    try {
      setIsBulkUpdating(true);
      const loadingToast = toast.loading(`Deleting ${selectedIds.length} items...`);
      
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

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(i => i.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Catalog</h2>
          <div className="flex items-center gap-3">
            <p className="text-[#666666] text-sm serif italic">Inventory and GST management</p>
            {lowStockItems.length > 0 && (
              <Badge className="bg-red-50 text-red-600 border-red-100 hover:bg-red-50 gap-1 rounded-full text-[10px] h-5">
                <AlertCircle className="w-3 h-3" />
                {lowStockItems.length} Low Stock Alerts
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" /> Import CSV
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleCsvImport} accept=".csv" />
              <Button size="sm" className="bg-black text-white gap-2" onClick={() => setIsFormOpen(true)}>
                <Plus className="w-4 h-4" /> Add Product
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 border rounded-lg">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
          <Input 
            placeholder="Search products or HSN..." 
            className="pl-10 h-9" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#999999]">Filter by Category:</span>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden relative">
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-20 flex items-center gap-6 border border-white/10 backdrop-blur-md"
            >
              <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                <div className="w-5 h-5 bg-[#FFAA00] rounded-full flex items-center justify-center text-[10px] font-black text-black">
                  {selectedIds.length}
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-white/70">Selected</span>
              </div>

              {canDelete && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 pr-4 gap-2 text-red-400 hover:text-red-300 hover:bg-red-950/20 font-bold text-[10px] uppercase tracking-widest border-r border-white/10 rounded-none"
                  onClick={handleBulkDelete}
                  disabled={isBulkUpdating}
                >
                  <Trash2 className="w-3 h-3" /> Delete Selected
                </Button>
              )}
              
              {canEdit && (
                <div className="flex items-center gap-3 px-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFAA00]">Add Stock:</span>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      placeholder="+/- Qty" 
                      className="w-24 h-8 bg-white/5 border-white/10 text-white text-xs font-bold"
                      value={bulkStockValue}
                      onChange={(e) => setBulkStockValue(e.target.value)}
                    />
                    <Button 
                      size="sm" 
                      className="h-8 px-4 bg-[#237227] hover:bg-[#1B561E] text-white font-black text-[10px] uppercase tracking-widest"
                      onClick={handleBulkStockUpdate}
                      disabled={isBulkUpdating || !bulkStockValue}
                    >
                      Update
                    </Button>
                  </div>
                </div>
              )}

              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-white/10 text-white/50"
                onClick={() => setSelectedIds([])}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <Table>
          <TableHeader className="bg-[#FAFAFA]">
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-[#666666]">Product Name</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-[#666666]">Category</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-center text-[#666666]">HSN</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-right text-[#666666]">Price (₹)</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-right text-[#666666]">GST %</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-right text-[#666666]">Stock</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12">Loading products...</TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12">No products found</TableCell></TableRow>
            ) : filteredItems.map((item) => (
              <TableRow key={item.id} className={cn(selectedIds.includes(item.id) && "bg-slate-50")}>
                <TableCell>
                  <Checkbox 
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={() => toggleSelectOne(item.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{item.name}</div>
                  {item.stock < threshold && (
                    <Badge className="mt-1 bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[9px] uppercase tracking-tighter h-4">
                      Low Stock
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold border-slate-200">
                    {item.category || 'General'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-mono text-xs">{item.hsn}</TableCell>
                <TableCell className="text-right font-mono text-sm">₹{item.price.toLocaleString()}</TableCell>
                <TableCell className="text-right text-sm">{item.gstRate}%</TableCell>
                <TableCell className={cn("text-right font-mono text-sm", item.stock < threshold ? "text-amber-600 font-bold" : "")}>
                  {item.stock} {item.unit}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#999999]"
                        />
                      }
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && (
                        <DropdownMenuItem className="gap-2" onClick={() => { setEditingItem(item); setIsFormOpen(true); }}>
                          <FileEdit className="w-4 h-4" /> Edit
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem className="gap-2 text-red-600" onClick={() => deleteItem(item.id)}>
                          <Trash2 className="w-4 h-4" /> Delete
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

      <ItemForm 
        isOpen={isFormOpen} 
        onClose={() => { setIsFormOpen(false); setEditingItem(null); }} 
        onSave={handleSave}
        item={editingItem}
      />
    </div>
  );
}
