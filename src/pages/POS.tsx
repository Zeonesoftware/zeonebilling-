import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useData, useSettings } from '@/hooks/useData';
import { Item, Client, Invoice, InvoiceItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingCart, 
  User, 
  Plus, 
  Minus,
  Search, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  Keyboard,
  XCircle,
  Package
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency, calculateGST } from '@/lib/invoice-utils';
import { InvoiceView } from '@/components/invoices/InvoiceView';

export default function POS() {
  const { data: items, updateItem: updateProduct } = useData<Item>('items');
  const { data: clients } = useData<Client>('clients');
  const { addItem: addInvoice } = useData<Invoice>('invoices');
  const { settings } = useSettings();
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [showQuickDialog, setShowQuickDialog] = useState(false);
  const [selectedPrintStyle, setSelectedPrintStyle] = useState<Invoice['pdfStyle'] | 'Thermal'>('Professional');

  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('c1');
  const [searchTerm, setSearchTerm] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2: Focus Search
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeRef.current?.focus();
      }
      // F4: Clear Cart
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0 && confirm('Clear current cart?')) {
          setCart([]);
          toast('Cart cleared');
        }
      }
      // Alt + C: Checkout
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCheckout();
      }
      // F10: Print
      if (e.key === 'F10') {
        e.preventDefault();
        handlePrint();
      }
      // Escape: Clear search
      if (e.key === 'Escape') {
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  const addToCart = useCallback((item: Item) => {
    setCart(prevCart => {
      const client = clients.find(c => c.id === selectedClientId) || clients[0];
      const isInterState = client?.stateCode && settings?.stateCode ? client.stateCode !== settings.stateCode : false;
      const gstResults = calculateGST(item.price, 1, item.gstRate, isInterState);

      const existing = prevCart.find(i => i.itemId === item.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        const updatedGst = calculateGST(item.price, newQty, item.gstRate, isInterState);
        return prevCart.map(i => 
          i.itemId === item.id 
            ? { 
                ...i, 
                quantity: newQty, 
                cgst: updatedGst.cgst, 
                sgst: updatedGst.sgst, 
                igst: updatedGst.igst, 
                total: updatedGst.total 
              } 
            : i
        );
      } else {
        return [...prevCart, {
          itemId: item.id,
          name: item.name,
          hsn: item.hsn,
          quantity: 1,
          price: item.price,
          gstRate: item.gstRate,
          cgst: gstResults.cgst,
          sgst: gstResults.sgst,
          igst: gstResults.igst,
          total: gstResults.total
        }];
      }
    });
    toast.success(`${item.name} added`, { duration: 1000 });
  }, [clients, selectedClientId, settings]);

  const updateQuantity = (id: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.itemId === id) {
          const newQty = Math.max(0, item.quantity + delta);
          if (newQty === 0) return item;
          
          const client = clients.find(c => c.id === selectedClientId) || clients[0];
          const isInterState = client?.stateCode && settings?.stateCode ? client.stateCode !== settings.stateCode : false;
          const gstResults = calculateGST(item.price, newQty, item.gstRate, isInterState);
          
          return {
            ...item,
            quantity: newQty,
            cgst: gstResults.cgst,
            sgst: gstResults.sgst,
            igst: gstResults.igst,
            total: gstResults.total
          };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = useCallback((id: string) => {
    setCart(prevCart => prevCart.filter(i => i.itemId !== id));
  }, []);

  const subtotal = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const totalCgst = cart.reduce((acc, i) => acc + i.cgst, 0);
  const totalSgst = cart.reduce((acc, i) => acc + i.sgst, 0);
  const totalIgst = cart.reduce((acc, i) => acc + (i.igst || 0), 0);
  const total = subtotal + totalCgst + totalSgst + totalIgst;

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    const client = clients.find(c => c.id === selectedClientId) || clients[0];
    
    if (!settings?.stateCode) {
      return toast.error('Business state code is missing in Settings. Please set it for tax calculation.');
    }
    
    const invoice: Partial<Invoice> = {
      invoiceNumber: `POS-${Date.now().toString().slice(-6)}`,
      type: 'Tax Invoice',
      date: new Date().toISOString().split('T')[0],
      dueDate: '',
      clientId: client.id,
      clientName: client.name || 'Walk-in Customer',
      clientEmail: client.email || '',
      clientGstin: client.gstin || '',
      clientStateCode: client.stateCode || '',
      clientAddress: client.address || '',
      items: cart.map(item => ({
        ...item,
        hsn: item.hsn || '',
      })),
      subtotal: subtotal || 0,
      totalCgst: totalCgst || 0,
      totalSgst: totalSgst || 0,
      totalIgst: totalIgst || 0,
      totalAmount: total || 0,
      status: 'Paid',
    };

    try {
      const newInvoice = await addInvoice(invoice);
      setLastInvoice(newInvoice as Invoice);
      
      // Update Stock
      for (const cartItem of cart) {
        const product = items.find(i => i.id === cartItem.itemId);
        if (product) {
          await updateProduct(product.id, { stock: (product.stock || 0) - cartItem.quantity });
        }
      }

      setCart([]);
      toast.success('Checkout successful!', {
        description: 'Invoice generated and stock updated.'
      });
      setShowQuickDialog(true);
    } catch (err) {
      toast.error('Checkout failed');
    }
  };

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.hsn && i.hsn.includes(searchTerm)) ||
    (i.barcode && i.barcode.includes(searchTerm)) ||
    (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Auto-add on exact barcode match (simulating fast scanner)
  useEffect(() => {
    if (searchTerm.length >= 3) {
      const exactMatch = items.find(i => i.barcode === searchTerm);
      if (exactMatch) {
        addToCart(exactMatch);
        setSearchTerm('');
      }
    }
  }, [searchTerm, items, addToCart]);

  const lowStockThreshold = settings?.lowStockThreshold ?? 10;

  const handlePrint = () => {
    if (lastInvoice) {
      setSelectedPrintStyle('Professional');
      setShowInvoicePreview(true);
    } else {
      toast.error('No recent invoice found to print. Please complete a payment first.');
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 sm:gap-6 overflow-hidden min-h-[600px]">
      {/* Product Selection Side */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 h-full order-2 lg:order-1">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              ref={barcodeRef}
              placeholder="F2 search / Barcode..." 
              className="pl-10 h-12 sm:h-14 shadow-sm border-slate-200 focus-visible:ring-[#237227] text-base sm:text-lg rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredItems.length === 1) {
                  addToCart(filteredItems[0]);
                  setSearchTerm('');
                }
              }}
            />
          </div>
          <div className="hidden sm:flex gap-2 shrink-0">
            <Badge variant="outline" className="h-10 px-3 flex gap-2 items-center bg-white border-slate-200 shrink-0">
               <Keyboard className="w-4 h-4 text-slate-400" />
               <span className="text-[10px] font-bold text-slate-500 uppercase">F2: Search</span>
            </Badge>
            <Badge variant="outline" className="h-10 px-3 flex gap-2 items-center bg-white border-slate-200 shrink-0">
               <span className="text-[10px] font-bold text-slate-500 uppercase">Alt+C: Checkout</span>
            </Badge>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 bg-white/50 rounded-2xl border border-slate-100 p-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 xxl:grid-cols-4 gap-3 p-1">
            {filteredItems.map(item => {
              const isLowStock = (item.stock || 0) > 0 && (item.stock || 0) <= lowStockThreshold;
              const isOutOfStock = (item.stock || 0) <= 0;

              return (
                <Card 
                  key={item.id} 
                  className={cn(
                    "cursor-pointer hover:border-[#237227] transition-all group border-slate-200 shadow-sm relative overflow-hidden",
                    isOutOfStock && "opacity-60 grayscale",
                    isLowStock && "border-red-200 bg-red-50/10"
                  )}
                  onClick={() => !isOutOfStock && addToCart(item)}
                >
                  <CardContent className="p-3 sm:p-4 flex flex-col h-full gap-2">
                    <div className="flex justify-between items-start">
                      <div className={cn(
                        "w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-[#237227] group-hover:text-white transition-colors",
                        isLowStock && "bg-red-50 text-red-400"
                      )}>
                        {isLowStock ? <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" /> : <Plus className="w-4 h-4 sm:w-5 sm:h-5" />}
                      </div>
                      {item.stock !== undefined && (
                        <Badge 
                          variant={isOutOfStock ? "outline" : isLowStock ? "destructive" : "secondary"} 
                          className={cn(
                            "text-[8px] sm:text-[9px] font-black tracking-tighter",
                            isLowStock && "animate-pulse"
                          )}
                        >
                          {item.stock} IN STOCK
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 mt-1 flex-1">
                      <h3 className="font-black text-xs sm:text-sm text-slate-800 leading-tight line-clamp-2">{item.name}</h3>
                      <p className="text-[8px] sm:text-[9px] uppercase font-mono text-slate-400 tracking-widest">{item.hsn ? `HSN: ${item.hsn}` : 'NO HSN'}</p>
                    </div>
                    <div className="pt-2 flex items-center justify-between border-t border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Selling Price</span>
                        <span className="font-black text-base sm:text-lg text-slate-900">₹{item.price}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] sm:text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-100">{item.gstRate}% GST</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
               <Package className="w-16 h-16 mb-4 opacity-20" />
               <p className="text-sm font-bold uppercase tracking-widest">No matching products</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Cart / Checkout Side */}
      <div className="w-full lg:w-[380px] xl:w-[420px] bg-white border border-slate-200 rounded-2xl flex flex-col shadow-2xl shadow-slate-100 overflow-hidden h-full order-1 lg:order-2">
        <div className="p-4 sm:p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#237227] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#237227]/20">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg text-slate-800 leading-none">Checkout</h2>
              <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">Session #0023</p>
            </div>
          </div>
          <Badge className="bg-black text-white rounded-full px-2 sm:px-3 py-1 font-black text-[10px] sm:text-xs">{cart.length} ITEMS</Badge>
        </div>

        <div className="p-3 sm:p-4 bg-white border-b border-slate-50 shrink-0">
          <div className="flex items-center gap-3 p-2 sm:p-3 bg-slate-50 rounded-xl border border-slate-100 transition-all focus-within:border-[#237227] focus-within:bg-white">
            <User className="w-4 h-4 text-slate-400" />
            <div className="flex-1 overflow-hidden">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Client Selection</p>
              <select 
                className="bg-transparent text-sm font-bold w-full focus:outline-none text-slate-800 cursor-pointer truncate"
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                }}
              >
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 bg-slate-50/20">
          <div className="p-3 sm:p-4 space-y-3">
            {cart.map(item => (
              <div 
                key={item.itemId} 
                className="group p-2 sm:p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-sm transition-all flex items-center gap-2 sm:gap-3"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300 font-bold text-xs uppercase overflow-hidden shrink-0">
                  {item.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-[10px] sm:text-xs text-slate-800 uppercase tracking-tight truncate mb-0.5">{item.name}</div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-400">₹{item.price} + {item.gstRate}%</span>
                    <Badge variant="outline" className="text-[7px] sm:text-[8px] py-0 border-slate-100 text-slate-400 font-bold hidden xs:inline">HSN: {item.hsn}</Badge>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 sm:h-6 sm:w-6 rounded-md hover:bg-white hover:text-red-500"
                      onClick={() => updateQuantity(item.itemId, -1)}
                    >
                      <Minus className="w-2.5 h-2.5 sm:w-3 h-3" />
                    </Button>
                    <span className="w-4 sm:w-6 text-center text-[10px] sm:text-xs font-black text-slate-700">{item.quantity}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 sm:h-6 sm:w-6 rounded-md hover:bg-white hover:text-[#237227]"
                      onClick={() => updateQuantity(item.itemId, 1)}
                    >
                      <Plus className="w-2.5 h-2.5 sm:w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[11px] sm:text-sm text-slate-900">₹{item.total.toFixed(0)}</span>
                    <button 
                      className="text-slate-200 hover:text-red-500 transition-colors p-1"
                      onClick={() => removeFromCart(item.itemId)}
                    >
                      <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 sm:py-10 text-slate-200 border-2 border-dashed border-slate-100 rounded-3xl">
                <ShoppingCart className="w-8 h-8 sm:w-12 sm:h-12 mb-3 opacity-10" />
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Cart is empty</p>
                <p className="text-[8px] sm:text-[10px] text-slate-400 mt-1">Add items to begin</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 space-y-3 shrink-0">
          <div className="space-y-1.5 p-2 sm:p-3 bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
            <div className="flex justify-between items-center text-[9px] sm:text-[10px]">
              <span className="font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
              <span className="font-black text-slate-700">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-[9px] sm:text-[10px]">
              <span className="font-bold text-slate-400 uppercase tracking-widest">Calculated GST</span>
              <span className="font-black text-emerald-600">
                {totalIgst > 0 ? (
                  `+ ₹${totalIgst.toFixed(2)} (IGST)`
                ) : (
                  `+ ₹${(totalCgst + totalSgst).toFixed(2)} (C+S GST)`
                )}
              </span>
            </div>
            <div className="pt-2 mt-1 border-t border-slate-100 flex justify-between items-center">
              <span className="font-black text-[10px] sm:text-[11px] text-slate-800 uppercase tracking-tighter">Payable Amount</span>
              <span className="font-black text-lg sm:text-xl text-[#237227] tracking-tighter">₹{total.toFixed(0)}</span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 shrink-0">
            <Button 
              className="col-span-4 h-11 sm:h-12 bg-[#237227] text-white hover:bg-[#1B561E] rounded-xl text-sm sm:text-base font-black gap-2 shadow-lg shadow-[#237227]/20 border-b-4 border-[#1B561E] active:border-0 active:translate-y-1 transition-all"
              onClick={handleCheckout}
            >
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              Complete Payment
            </Button>
            <Button 
              variant="outline" 
              className="h-11 sm:h-12 rounded-xl border-2 border-slate-200 hover:bg-white hover:border-[#237227] hover:text-[#237227] transition-all flex flex-col items-center justify-center gap-0.5 group"
              onClick={handlePrint}
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tighter">F10</span>
            </Button>
          </div>
          
          <div className="flex items-center justify-center gap-4 text-slate-400 shrink-0">
             <div className="flex items-center gap-1">
                <Keyboard className="w-2.5 h-2.5" />
                <span className="text-[7px] font-black uppercase tracking-tighter">Shortcuts Active</span>
             </div>
             <button 
               className="text-[7px] font-black uppercase tracking-tighter text-slate-500 hover:text-red-500 underline decoration-dotted"
               onClick={() => cart.length > 0 && confirm('Clear cart?') && setCart([])}
             >
                Clear Cart (F4)
             </button>
          </div>
        </div>
      </div>

      {showQuickDialog && lastInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">Payment Complete!</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Invoice #{lastInvoice.invoiceNumber} generated successfully.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <Button 
                className="h-12 bg-[#237227] text-white hover:bg-[#1B561E] rounded-xl font-black gap-2"
                onClick={() => {
                  setSelectedPrintStyle('Professional');
                  setShowInvoicePreview(true);
                  setShowQuickDialog(false);
                }}
              >
                <Printer className="w-5 h-5" /> Standard Print (A4)
              </Button>
              <Button 
                variant="outline" 
                className="h-12 border-2 border-slate-200 hover:border-black rounded-xl font-black gap-2"
                onClick={() => {
                  setSelectedPrintStyle('Thermal');
                  setShowInvoicePreview(true);
                  setShowQuickDialog(false);
                }}
              >
                <Printer className="w-5 h-5" /> Quick Thermal Receipt
              </Button>
              <Button 
                variant="ghost" 
                className="h-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest"
                onClick={() => {
                  setShowQuickDialog(false);
                  setLastInvoice(null);
                }}
              >
                Dismiss / New Sale
              </Button>
            </div>
          </div>
        </div>
      )}

      {showInvoicePreview && lastInvoice && (
        <InvoiceView 
          invoice={lastInvoice}
          settings={settings}
          initialStyle={selectedPrintStyle}
          onClose={() => {
            setShowInvoicePreview(false);
            setLastInvoice(null);
          }}
        />
      )}
    </div>
  );
}

