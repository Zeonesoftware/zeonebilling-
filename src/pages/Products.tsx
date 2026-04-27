import React, { useState, useRef } from 'react';
import { useData, useSettings } from '@/hooks/useData';
import { useRBAC } from '@/hooks/useRBAC';
import { Item } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Package, MoreHorizontal, FileEdit, Trash2, Upload, CheckCircle2, XCircle, AlertCircle, Barcode, Printer, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ItemForm } from '@/components/products/ItemForm';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { useMemo } from 'react';

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
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const threshold = settings?.lowStockThreshold || 10;
  const lowStockItems = items.filter(i => i.stock < threshold);

  const categories = ['All', ...Array.from(new Set(items.map(i => i.category || 'General')))];

  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.hsn.includes(searchTerm) ||
      (i.barcode && i.barcode.includes(searchTerm));
    
    const matchesCategory = selectedCategory === 'All' || (i.category || 'General') === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const groupedItems = useMemo(() => {
    if (!groupByCategory) return { 'All Products': filteredItems };
    
    const groups = filteredItems.reduce((acc, item) => {
      const cat = item.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, Item[]>);

    // Sort categories alphabetically
    return Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {} as Record<string, Item[]>);
  }, [filteredItems, groupByCategory]);

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
            barcode: row.barcode || '',
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

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  const toggleAllCategories = (collapse: boolean) => {
    if (collapse) {
      const allCats = Object.keys(groupedItems).filter(k => k !== 'All Products');
      setCollapsedCategories(allCats);
    } else {
      setCollapsedCategories([]);
    }
  };

  const handlePrintBarcode = (item: Item) => {
    if (!item.barcode) {
      toast.error('No barcode available for this product');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode - ${item.name}</title>
          <style>
            @media print {
              body { margin: 0; padding: 10px; }
            }
            body { 
              font-family: 'Inter', sans-serif; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center;
              height: 100vh;
              text-align: center;
            }
            .label {
              border: 1px solid #eee;
              padding: 20px;
              width: 250px;
              border-radius: 8px;
            }
            .name { font-weight: 800; font-size: 14px; margin-bottom: 5px; text-transform: uppercase; }
            .barcode-box { 
              background: black; 
              height: 60px; 
              width: 100%; 
              margin: 10px 0;
              display: flex;
              align-items: flex-end;
              justify-content: space-around;
              padding: 0 5px;
            }
            .bar { background: white; width: 2px; height: 100%; }
            .bar.thin { width: 1px; }
            .bar.thick { width: 4px; }
            .barcode-val { font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 4px; }
            .price { font-size: 18px; font-weight: 900; margin-top: 5px; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="name">${item.name}</div>
            <div class="barcode-box">
              ${Array.from({length: 30}).map((_, i) => `<div class="bar ${i % 3 === 0 ? 'thick' : i % 2 === 0 ? 'thin' : ''}"></div>`).join('')}
            </div>
            <div class="barcode-val">${item.barcode}</div>
            <div class="price">₹${item.price}</div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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

        <div className="flex items-center gap-2 ml-auto">
          {groupByCategory && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 gap-2 text-[10px] font-bold uppercase tracking-widest text-[#999999]"
              onClick={() => toggleAllCategories(collapsedCategories.length < Object.keys(groupedItems).length)}
            >
              <ChevronsUpDown className="w-3 h-3" />
              {collapsedCategories.length < Object.keys(groupedItems).length ? 'Collapse All' : 'Expand All'}
            </Button>
          )}
          <Switch id="group-mode" checked={groupByCategory} onCheckedChange={(val) => { setGroupByCategory(val); if (!val) setCollapsedCategories([]); }} />
          <Label htmlFor="group-mode" className="text-[10px] font-bold uppercase tracking-widest text-[#999999] cursor-pointer">Group by Category</Label>
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
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 pr-4 gap-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950/20 font-bold text-[10px] uppercase tracking-widest border-r border-white/10 rounded-none"
                  onClick={() => {
                    const selectedItems = items.filter(i => selectedIds.includes(i.id) && i.barcode);
                    if (selectedItems.length === 0) return toast.error('No items with barcodes selected');

                    const printWindow = window.open('', '_blank');
                    if (!printWindow) return;

                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Print Barcodes</title>
                          <style>
                            @media print { body { margin: 0; } }
                            body { font-family: 'Inter', sans-serif; display: flex; flex-wrap: wrap; padding: 10px; gap: 10px; }
                            .label { border: 1px solid #eee; padding: 15px; width: 220px; text-align: center; border-radius: 8px; page-break-inside: avoid; }
                            .name { font-weight: 800; font-size: 12px; margin-bottom: 5px; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                            .barcode-box { background: black; height: 40px; width: 100%; margin: 5px 0; display: flex; align-items: flex-end; justify-content: space-around; padding: 0 5px; }
                            .bar { background: white; width: 1px; height: 100%; }
                            .barcode-val { font-family: monospace; font-size: 14px; font-weight: bold; }
                            .price { font-size: 16px; font-weight: 900; }
                          </style>
                        </head>
                        <body>
                          ${selectedItems.map(item => `
                            <div class="label">
                              <div class="name">${item.name}</div>
                              <div class="barcode-box">
                                ${Array.from({length: 25}).map(() => `<div class="bar"></div>`).join('')}
                              </div>
                              <div class="barcode-val">${item.barcode}</div>
                              <div class="price">₹${item.price}</div>
                            </div>
                          `).join('')}
                          <script>
                            window.onload = () => {
                              window.print();
                              setTimeout(() => window.close(), 500);
                            };
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                >
                  <Printer className="w-3 h-3" /> Print Labels
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
              <TableHead className="w-[60px] font-mono text-[10px] uppercase tracking-widest text-[#666666]">Img</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-[#666666]">Product Name</TableHead>
              {!groupByCategory && <TableHead className="hidden md:table-cell font-mono text-[10px] uppercase tracking-widest text-[#666666]">Category</TableHead>}
              <TableHead className="hidden lg:table-cell font-mono text-[10px] uppercase tracking-widest text-center text-[#666666]">HSN</TableHead>
              <TableHead className="hidden md:table-cell font-mono text-[10px] uppercase tracking-widest text-center text-[#666666]">Barcode</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-right text-[#666666]">Price (₹)</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-center text-[#666666]">GST (%)</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-right text-[#666666]">Stock</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12">Loading products...</TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12">No products found</TableCell></TableRow>
            ) : (
              (Object.entries(groupedItems) as [string, Item[]][]).map(([category, itemsInGroup]) => {
                const totalStock = itemsInGroup.reduce((sum, item) => sum + item.stock, 0);
                const totalValue = itemsInGroup.reduce((sum, item) => sum + (item.price * item.stock), 0);

                const isCollapsed = collapsedCategories.includes(category);

                return (
                  <React.Fragment key={category}>
                    {groupByCategory && (
                      <TableRow 
                        className="bg-slate-50/80 hover:bg-slate-100/80 border-y border-slate-100 cursor-pointer transition-colors"
                        onClick={() => toggleCategoryCollapse(category)}
                      >
                        <TableCell colSpan={2} className="py-2">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="text-xs font-black uppercase tracking-widest text-slate-900">{category}</span>
                            <Badge variant="outline" className="bg-white text-[9px] h-4 px-1.5 border-slate-200 text-slate-500">
                              {itemsInGroup.length} Items
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell colSpan={groupByCategory ? 4 : 5} className="py-2">
                          <div className="flex items-center justify-end gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <div className="flex flex-col items-end">
                              <span className="text-[8px]">Total Stock</span>
                              <span className="text-slate-700">{totalStock}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[8px]">Total Value</span>
                              <span className="text-[#237227]">₹{totalValue.toLocaleString()}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                    {!isCollapsed && itemsInGroup.map((item) => (
                      <TableRow key={item.id} className={cn(selectedIds.includes(item.id) && "bg-slate-50")}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.includes(item.id)}
                            onCheckedChange={() => toggleSelectOne(item.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {item.imageUrl ? (
                            <div 
                              className="w-10 h-10 rounded border border-slate-200 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setSelectedImage(item.imageUrl!)}
                            >
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-300">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{item.name}</div>
                          {item.stock < threshold && (
                            <Badge className="mt-1 bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[9px] uppercase tracking-tighter h-4">
                              Low
                            </Badge>
                          )}
                        </TableCell>
                        {!groupByCategory && (
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold border-slate-200">
                              {item.category || 'General'}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="hidden lg:table-cell text-center font-mono text-xs">{item.hsn}</TableCell>
                        <TableCell className="hidden md:table-cell text-center font-mono text-xs">{item.barcode || '-'}</TableCell>
                        <TableCell className="font-mono text-right text-xs sm:text-sm">₹{item.price.toLocaleString()}</TableCell>
                        <TableCell className="text-center text-sm font-medium">{item.gstRate}%</TableCell>
                        <TableCell className={cn("text-right font-mono text-xs sm:text-sm", item.stock < threshold ? "text-amber-600 font-bold" : "")}>
                          {item.stock} <span className="hidden xs:inline">{item.unit}</span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[#999999]"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit && (
                                <DropdownMenuItem className="gap-2" onClick={() => handlePrintBarcode(item)}>
                                  <Barcode className="w-4 h-4" /> Print Barcode
                                </DropdownMenuItem>
                              )}
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
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ItemForm 
        isOpen={isFormOpen} 
        onClose={() => { setIsFormOpen(false); setEditingItem(null); }} 
        onSave={handleSave}
        item={editingItem}
      />

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="sm:max-w-[600px] p-1 bg-black border-none">
          <div className="flex justify-center items-center bg-black rounded-lg overflow-hidden min-h-[300px]">
            {selectedImage && (
              <img 
                src={selectedImage} 
                alt="Product Preview" 
                className="max-w-full max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
