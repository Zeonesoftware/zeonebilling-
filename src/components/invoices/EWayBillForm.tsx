import React, { useState } from 'react';
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
import { Truck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface EWayBillFormProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onSuccess: (updatedInvoice: Invoice) => void;
}

export function EWayBillForm({ isOpen, onClose, invoice, onSuccess }: EWayBillFormProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    transporterName: invoice.transporterName || '',
    transporterId: invoice.transporterId || '',
    vehicleNo: invoice.vehicleNo || '',
    distance: invoice.distance || 0,
    transportMode: invoice.transportMode || 'Road' as const,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // In a real app, this would call our Express backend which then calls the GST/NIC API
      const response = await fetch('/api/ewaybill/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          ...formData
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate E-Way Bill');
      }

      const result = await response.json();
      
      // Update Firestore with the new E-Way Bill info
      const invoiceRef = doc(db, 'invoices', invoice.id);
      const updateData = {
        ewayBillNo: result.ewayBillNo,
        ewayBillDate: result.ewayBillDate,
        ewayBillStatus: 'Generated',
        ...formData,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.uid
      };
      
      await updateDoc(invoiceRef, updateData);
      
      toast.success('E-Way Bill Generated Successfully!', {
        description: `E-Way Bill No: ${result.ewayBillNo}`,
        icon: <CheckCircle2 className="text-green-500" />
      });

      onSuccess({ ...invoice, ...updateData } as Invoice);
      onClose();
    } catch (error) {
      console.error('E-Way Bill Error:', error);
      toast.error('Generation Failed', {
        description: error instanceof Error ? error.message : 'Please try again later',
        icon: <AlertCircle className="text-red-500" />
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="bg-slate-900 text-white p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/10 rounded-xl">
              <Truck className="w-6 h-6 text-blue-400" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">Generate E-Way Bill</DialogTitle>
          </div>
          <p className="text-slate-400 text-sm">
            Fill in the transportation details for Invoice <span className="font-mono text-white">#{invoice.invoiceNumber}</span>
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2 col-span-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Transporter Name</Label>
              <Input 
                value={formData.transporterName}
                onChange={e => setFormData({...formData, transporterName: e.target.value})}
                placeholder="e.g. Speed Logistics"
                className="h-12 rounded-xl border-slate-200 focus:ring-slate-900 transition-all font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Transporter GSTIN/ID</Label>
              <Input 
                value={formData.transporterId}
                onChange={e => setFormData({...formData, transporterId: e.target.value})}
                placeholder="GSTIN or ID"
                className="h-12 rounded-xl border-slate-200 focus:ring-slate-900 transition-all font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Vehicle Number</Label>
              <Input 
                value={formData.vehicleNo}
                onChange={e => setFormData({...formData, vehicleNo: e.target.value})}
                placeholder="MH-12-AB-1234"
                className="h-12 rounded-xl border-slate-200 focus:ring-slate-900 transition-all font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Approx Distance (KM)</Label>
              <Input 
                type="number"
                value={formData.distance}
                onChange={e => setFormData({...formData, distance: parseInt(e.target.value) || 0})}
                className="h-12 rounded-xl border-slate-200 focus:ring-slate-900 transition-all font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Transport Mode</Label>
              <Select 
                value={formData.transportMode} 
                onValueChange={(v: any) => setFormData({...formData, transportMode: v})}
              >
                <SelectTrigger className="h-12 rounded-xl border-slate-200 focus:ring-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  <SelectItem value="Road">Road</SelectItem>
                  <SelectItem value="Rail">Rail</SelectItem>
                  <SelectItem value="Air">Air</SelectItem>
                  <SelectItem value="Ship">Ship</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4 gap-3 flex-row justify-end items-center sm:justify-end">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose}
              className="h-12 px-6 rounded-xl font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="h-12 px-10 rounded-xl font-bold bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-200 transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Generate E-Way Bill'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
