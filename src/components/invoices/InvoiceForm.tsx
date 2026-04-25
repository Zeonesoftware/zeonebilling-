import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  Calculator,
  UserPlus,
  PackagePlus,
  ArrowLeft,
  Barcode,
  Save,
  Clock,
  Globe,
  Check,
  Loader2,
  Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/hooks/useData';
import { Client, Item, Invoice, InvoiceItem, BusinessSettings } from '@/types';
import { toast } from 'sonner';
import { formatCurrency, calculateGST, generateNextInvoiceNumber } from '@/lib/invoice-utils';
import { InvoiceView } from './InvoiceView';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface InvoiceFormProps {
  onSave: (invoice: Partial<Invoice>) => void;
  onCancel: () => void;
  settings: BusinessSettings;
  invoices: Invoice[];
  initialData?: Partial<Invoice>;
}

export function InvoiceForm({ onSave, onCancel, settings, invoices, initialData }: InvoiceFormProps) {
  const { data: clients } = useData<Client>('clients');
  const { data: items } = useData<Item>('items');

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceType, setInvoiceType] = useState<Invoice['type']>('Tax Invoice');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [extraPages, setExtraPages] = useState('');
  const [currency, setCurrency] = useState(settings.currency || 'INR');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [status, setStatus] = useState<Invoice['status']>('Pending');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // E-Way Bill State
  const [ewayBillNo, setEwayBillNo] = useState('');
  const [ewayBillStatus, setEwayBillStatus] = useState<Invoice['ewayBillStatus']>('Pending');
  const [transporterName, setTransporterName] = useState('');
  const [transporterId, setTransporterId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [distance, setDistance] = useState(0);
  const [transportMode, setTransportMode] = useState<Invoice['transportMode']>('Road');
  const [isGeneratingEway, setIsGeneratingEway] = useState(false);

  // Initialize from initialData or defaults
  useEffect(() => {
    if (initialData) {
      if (initialData.clientId) {
        const client = clients.find(c => c.id === initialData.clientId);
        if (client) setSelectedClient(client);
      }
      if (initialData.items) setInvoiceItems(initialData.items);
      if (initialData.type) setInvoiceType(initialData.type);
      if (initialData.date) setDate(initialData.date);
      if (initialData.dueDate) setDueDate(initialData.dueDate);
      if (initialData.notes) setNotes(initialData.notes);
      if (initialData.internalNotes) setInternalNotes(initialData.internalNotes);
      if (initialData.extraPages) setExtraPages(initialData.extraPages);
      if (initialData.currency) setCurrency(initialData.currency);
      if (initialData.status) setStatus(initialData.status);
      
      // E-Way Bill initialization
      if (initialData.ewayBillNo) setEwayBillNo(initialData.ewayBillNo);
      if (initialData.ewayBillStatus) setEwayBillStatus(initialData.ewayBillStatus);
      if (initialData.transporterName) setTransporterName(initialData.transporterName);
      if (initialData.transporterId) setTransporterId(initialData.transporterId);
      if (initialData.vehicleNo) setVehicleNo(initialData.vehicleNo);
      if (initialData.distance) setDistance(initialData.distance);
      if (initialData.transportMode) setTransportMode(initialData.transportMode);
    }
  }, [initialData, clients]);

  // Generate Invoice Number
  useEffect(() => {
    if (!initialData?.invoiceNumber) {
      setInvoiceNumber(generateNextInvoiceNumber(invoices, settings, date));
    } else {
      setInvoiceNumber(initialData.invoiceNumber);
    }
  }, [settings, initialData, invoices, date]);

  // Auto-save logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (invoiceItems.length > 0 && selectedClient) {
        setIsAutoSaving(true);
        // In a real app, we'd call an API here to save a draft
        setTimeout(() => setIsAutoSaving(false), 500);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [invoiceItems, selectedClient, invoiceType, notes]);

  const recalculateItem = useCallback((item: InvoiceItem, quantity: number, price: number, client: Client | null) => {
    const isInterState = client ? client.stateCode !== settings.stateCode : false;
    const gstResults = calculateGST(price, quantity, item.gstRate, isInterState);
    
    return {
      ...item,
      quantity,
      price,
      cgst: gstResults.cgst,
      sgst: gstResults.sgst,
      igst: gstResults.igst,
      total: gstResults.total
    };
  }, [settings.stateCode]);

  const handleClientSelect = (val: string) => {
    const client = clients.find(c => c.id === val) || null;
    if (client && !client.stateCode) {
      toast.warning(`Client "${client.name}" has no state code. IGST vs CGST/SGST logic requires this field.`, {
        description: "Please update client details for accurate tax reporting.",
        duration: 5000
      });
    }
    setSelectedClient(client);
  };

  const addItemRow = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const isInterState = selectedClient ? selectedClient.stateCode !== settings.stateCode : false;
    const gstResults = calculateGST(item.price, 1, item.gstRate, isInterState);

    const newItem: InvoiceItem = {
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
    };
    
    setInvoiceItems([...invoiceItems, newItem]);
  };

  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find(i => i.barcode === barcodeInput);
    if (item) {
      addItemRow(item.id);
      setBarcodeInput('');
      toast.success(`Added ${item.name}`);
    } else {
      toast.error('Product not found for this barcode');
    }
  };

  const handleGenerateEwayBill = async () => {
    if (!selectedClient) return toast.error('Please select a client first');
    if (totalAmount < 50000 && invoiceType === 'Tax Invoice') {
      toast.info('Note: E-Way Bill is usually voluntary for amounts under 50,000');
    }

    if (!transporterId && !vehicleNo) {
      return toast.error('Transporter ID or Vehicle Number is required');
    }

    setIsGeneratingEway(true);
    
    // Simulate API Call to GST Portal / NIC
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockEwayNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setEwayBillNo(mockEwayNo);
    setEwayBillStatus('Generated');
    setIsGeneratingEway(false);
    toast.success('E-Way Bill Generated Successfully!');
  };

  const removeItemRow = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, qty: number) => {
    const updated = [...invoiceItems];
    updated[index] = recalculateItem(updated[index], qty, updated[index].price, selectedClient);
    setInvoiceItems(updated);
  };

  const updatePrice = (index: number, price: number) => {
    const updated = [...invoiceItems];
    updated[index] = recalculateItem(updated[index], updated[index].quantity, price, selectedClient);
    setInvoiceItems(updated);
  };

  // When client changes, recalculate all taxes
  useEffect(() => {
    setInvoiceItems(prev => prev.map(item => recalculateItem(item, item.quantity, item.price, selectedClient)));
  }, [selectedClient, recalculateItem]);

  const subtotal = invoiceItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalCgst = invoiceItems.reduce((acc, item) => acc + item.cgst, 0);
  const totalSgst = invoiceItems.reduce((acc, item) => acc + item.sgst, 0);
  const totalIgst = invoiceItems.reduce((acc, item) => acc + item.igst, 0);
  const totalAmount = subtotal + totalCgst + totalSgst + totalIgst;

  const getDraftInvoice = (): Invoice => ({
    id: initialData?.id || 'draft',
    invoiceNumber,
    type: invoiceType,
    date,
    dueDate,
    clientId: selectedClient?.id || '',
    clientName: selectedClient?.name || 'Valued Customer',
    clientEmail: selectedClient?.email || '',
    clientGstin: selectedClient?.gstin || '',
    clientAddress: selectedClient?.address || '',
    clientStateCode: selectedClient?.stateCode || '',
    currency,
    items: invoiceItems,
    subtotal,
    totalCgst,
    totalSgst,
    totalIgst,
    totalAmount,
    status,
    notes,
    internalNotes,
    extraPages,
    pdfStyle: (initialData as Invoice)?.pdfStyle || 'Professional',
    ewayBillNo,
    ewayBillStatus,
    transporterName,
    transporterId,
    vehicleNo,
    distance,
    transportMode
  });

  const handleSave = () => {
    if (!selectedClient) return toast.error('Please select a client');
    if (!selectedClient.stateCode) return toast.error('Client state code is required for GST validation');
    if (!settings.stateCode) return toast.error('Business state code is missing in Settings. Please set it for correct tax calculation.');
    if (invoiceItems.length === 0) return toast.error('Please add at least one item');

    onSave({
      invoiceNumber,
      type: invoiceType,
      date,
      dueDate,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      clientEmail: selectedClient.email,
      clientGstin: selectedClient.gstin,
      clientAddress: selectedClient.address,
      clientStateCode: selectedClient.stateCode,
      currency,
      items: invoiceItems,
      subtotal,
      totalCgst,
      totalSgst,
      totalIgst,
      totalAmount,
      status,
      notes,
      internalNotes,
      extraPages,
      ewayBillNo,
      ewayBillStatus,
      transporterName,
      transporterId,
      vehicleNo,
      distance,
      transportMode
    });
  };

  return (
    <div className="space-y-8 bg-white p-10 rounded-2xl border border-[#E5E5E5] max-w-6xl mx-auto shadow-2xl relative">
      {/* Auto-save indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {isAutoSaving ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
        ) : (
          <><Check className="w-3 h-3" /> Auto-saved</>
        )}
      </div>

      <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-8">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-full bg-slate-50">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">{initialData ? 'Edit' : 'Create'} {invoiceType}</h3>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-xs text-slate-400 font-mono uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border">{invoiceNumber}</span>
               <Badge className={cn(
                 "font-bold text-[8px] tracking-widest uppercase border-none hover:opacity-80",
                 status === 'Paid' ? "bg-green-100 text-green-700" : 
                 status === 'Pending' ? "bg-yellow-100 text-yellow-700" :
                 status === 'Cancelled' ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"
               )}>
                 {status}
               </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowPreview(true)} className="hidden sm:flex gap-2 rounded-lg px-6 font-bold uppercase text-[10px] tracking-widest border-slate-200">
             Preview PDF
          </Button>
          <Button variant="outline" onClick={onCancel} className="rounded-lg px-6 font-bold uppercase text-[10px] tracking-widest">Discard</Button>
          <Button onClick={handleSave} className="bg-[#237227] text-white hover:bg-[#1B561E] rounded-lg px-8 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-[#237227]/20 gap-2">
            <Save className="w-4 h-4" /> {initialData ? 'Update Record' : 'Finalize Document'}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          {/* Client Selection */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recipient Details</Label>
                <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-black uppercase tracking-widest text-[#237227]">
                  + New Client
                </Button>
              </div>
              <Select onValueChange={handleClientSelect} value={selectedClient?.id || ""}>
                <SelectTrigger className="h-12 border-slate-200 focus:ring-[#237227]">
                  <SelectValue placeholder="Search or select client...">
                    {selectedClient?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClient && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="text-sm font-bold text-slate-900">{selectedClient.name}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500 font-bold">
                    <span>GSTIN: {selectedClient.gstin}</span>
                    <span className={cn(!selectedClient.stateCode && "text-red-600 bg-red-50 px-1 rounded")}>
                      State: {selectedClient.stateCode || "MISSING"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 italic">{selectedClient.address}</div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Settings</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Currency</Label>
                  <Select value={currency || ""} onValueChange={(v: any) => setCurrency(v)}>
                    <SelectTrigger className="h-9 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Doc Type</Label>
                  <Select value={invoiceType || ""} onValueChange={(val: any) => setInvoiceType(val)}>
                    <SelectTrigger className="h-9 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tax Invoice">Tax Invoice</SelectItem>
                      <SelectItem value="Proforma">Proforma</SelectItem>
                      <SelectItem value="Bill of Supply">Bill of Supply</SelectItem>
                      <SelectItem value="Credit Note">Credit Note</SelectItem>
                      <SelectItem value="Delivery Challan">Delivery Challan</SelectItem>
                      <SelectItem value="E-invoice">E-invoice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Status</Label>
                  <Select value={status || ""} onValueChange={(val: any) => setStatus(val)}>
                    <SelectTrigger className="h-9 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Invoice Date</Label>
                  <Input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    className="h-9 border-slate-200 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Barcode / Item Search */}
          <div className="flex gap-4">
            <form onSubmit={handleBarcodeSearch} className="relative flex-1">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Scan Barcode or enter code..." 
                className="pl-10 h-10 border-slate-200 font-mono"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
              />
            </form>
            <Select onValueChange={addItemRow} value="">
              <SelectTrigger className="w-[240px] h-10 border-slate-200 font-bold text-xs uppercase tracking-widest">
                <SelectValue placeholder="Add Item Manually" />
              </SelectTrigger>
              <SelectContent>
                {items.map(item => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="hover:bg-transparent border-slate-200">
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-500">Service / Product</TableHead>
                  <TableHead className="w-[100px] font-black text-[10px] uppercase tracking-widest text-center">Qty</TableHead>
                  <TableHead className="w-[140px] font-black text-[10px] uppercase tracking-widest text-right">Rate</TableHead>
                  <TableHead className="w-[140px] font-black text-[10px] uppercase tracking-widest text-right">Tax</TableHead>
                  <TableHead className="w-[140px] font-black text-[10px] uppercase tracking-widest text-right">Net Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceItems.map((item, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-400 font-bold font-mono">HSN: {item.hsn}</div>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.quantity} 
                        onChange={e => updateQuantity(idx, Number(e.target.value))}
                        className="h-8 text-center font-bold font-mono border-slate-100"
                      />
                    </TableCell>
                    <TableCell>
                       <Input 
                        type="number" 
                        value={item.price} 
                        onChange={e => updatePrice(idx, Number(e.target.value))}
                        className="h-8 text-right font-bold font-mono border-slate-100"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="text-xs font-black text-slate-900">{item.gstRate}%</div>
                       <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                         {item.igst > 0 ? `IGST: ${item.igst.toFixed(2)}` : `C+S GST: ${(item.cgst + item.sgst).toFixed(2)}`}
                       </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-900 font-mono">
                      {formatCurrency(item.total, currency)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeItemRow(idx)} className="h-8 w-8 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {invoiceItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                       <div className="space-y-2">
                          <PackagePlus className="w-10 h-10 text-slate-200 mx-auto" />
                          <div className="text-sm font-bold text-slate-300 uppercase tracking-widest">No items listed</div>
                       </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           {/* Summary Sidebar */}
           <Card className="border-none bg-slate-900 text-white shadow-2xl rounded-2xl overflow-hidden p-8 space-y-8">
              <div className="space-y-1">
                 <div className="text-[10px] font-black uppercase tracking-[.2em] text-white/40">Grand Total</div>
                 <div className="text-4xl font-black font-mono tracking-tighter">{formatCurrency(totalAmount, currency)}</div>
              </div>

              {ewayBillNo && (
                <div className="p-3 bg-[#237227]/20 border border-[#237227]/30 rounded-xl space-y-1">
                  <div className="text-[9px] font-black uppercase text-[#519A66] tracking-widest flex items-center gap-2">
                    <Truck className="w-3 h-3" /> E-Way Bill Generated
                  </div>
                  <div className="text-sm font-mono font-bold tracking-wider">{ewayBillNo}</div>
                </div>
              )}

              <div className="space-y-4 pt-8 border-t border-white/10">
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/50">
                    <span>Subtotal</span>
                    <span className="font-mono text-white/80">{formatCurrency(subtotal, currency)}</span>
                 </div>
                 {totalIgst > 0 ? (
                   <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/50">
                      <span>IGST Total</span>
                      <span className="font-mono text-white/80">{formatCurrency(totalIgst, currency)}</span>
                   </div>
                 ) : (
                   <>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/50">
                        <span>CGST Total</span>
                        <span className="font-mono text-white/80">{formatCurrency(totalCgst, currency)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/50">
                        <span>SGST Total</span>
                        <span className="font-mono text-white/80">{formatCurrency(totalSgst, currency)}</span>
                    </div>
                   </>
                 )}
              </div>

              <div className="pt-8 space-y-4">
                 <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                    <div className="flex justify-between items-center">
                       <span className="text-[9px] font-black uppercase text-white/40 tracking-widest flex items-center gap-2">
                         <Globe className="w-3 h-3" /> Exchange Rate
                       </span>
                       <span className="text-[10px] font-mono text-white/60">1.00 USD = 83.45 INR</span>
                    </div>
                 </div>
              </div>

              <div className="pt-4">
                 <Button 
                   onClick={() => setShowPreview(true)}
                   className="w-full bg-[#237227] hover:bg-[#1B561E] text-white font-black uppercase text-xs tracking-widest h-14 rounded-xl shadow-lg ring-4 ring-[#237227]/20"
                 >
                   Generate Preview
                 </Button>
              </div>
           </Card>

           {/* E-Way Bill Section */}
           <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">E-Way Bill Details</Label>
                {totalAmount >= 50000 && !ewayBillNo && (
                   <Badge className="bg-orange-100 text-orange-700 font-bold text-[8px] animate-pulse">Required (&gt;50K)</Badge>
                )}
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Transport Mode</Label>
                      <Select value={transportMode} onValueChange={(v: any) => setTransportMode(v)}>
                        <SelectTrigger className="h-9 border-slate-200 text-xs shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['Road', 'Rail', 'Air', 'Ship'].map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Vehicle No</Label>
                      <Input 
                        value={vehicleNo} 
                        onChange={e => setVehicleNo(e.target.value.toUpperCase())}
                        className="h-9 border-slate-200 text-xs font-mono"
                        placeholder="MH01AB1234"
                      />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Transporter Name / ID</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={transporterName} 
                        onChange={e => setTransporterName(e.target.value)}
                        className="h-9 border-slate-200 text-xs flex-[2]"
                        placeholder="Transporter Name"
                      />
                      <Input 
                        value={transporterId} 
                        onChange={e => setTransporterId(e.target.value)}
                        className="h-9 border-slate-200 text-xs flex-1 font-mono"
                        placeholder="GSTIN/ID"
                      />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Approx Distance (km)</Label>
                      <Input 
                        type="number"
                        value={distance} 
                        onChange={e => setDistance(Number(e.target.value))}
                        className="h-9 border-slate-200 text-xs"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={handleGenerateEwayBill}
                        disabled={isGeneratingEway || !!ewayBillNo}
                        className={cn(
                          "w-full h-9 font-bold uppercase text-[9px] tracking-widest gap-2 transition-all",
                          ewayBillNo ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
                        )}
                      >
                        {isGeneratingEway ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                        {ewayBillNo ? 'Generated' : 'Generate EWB'}
                      </Button>
                    </div>
                 </div>
              </div>
           </div>

           {/* Meta Inputs */}
           <div className="space-y-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Public Customer Notes</Label>
                 <Textarea 
                   value={notes} 
                   onChange={e => setNotes(e.target.value)}
                   className="text-xs min-h-[80px] border-slate-200"
                   placeholder="Displayed on PDF footer..."
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Audit Notes</Label>
                 <Textarea 
                   value={internalNotes} 
                   onChange={e => setInternalNotes(e.target.value)}
                   className="text-xs min-h-[80px] bg-yellow-50/30 border-yellow-100"
                   placeholder="Private notes (not printed)..."
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Extra Rich Content Pages</Label>
                 <Textarea 
                   value={extraPages} 
                   onChange={e => setExtraPages(e.target.value)}
                   className="text-xs min-h-[120px] font-mono border-slate-200"
                   placeholder="Tables, Scope of work, etc (Appended to PDF)..."
                 />
              </div>
           </div>
        </div>
      </div>

      {showPreview && (
        <InvoiceView 
          invoice={getDraftInvoice()} 
          settings={settings} 
          onClose={() => setShowPreview(false)} 
        />
      )}
    </div>
  );
}
