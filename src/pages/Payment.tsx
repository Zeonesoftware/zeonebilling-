import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useData, useSettings } from '@/hooks/useData';
import { Invoice } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ArrowLeft, ShieldCheck, CreditCard, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/invoice-utils';
import { toast } from 'sonner';

export default function Payment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: invoices, updateItem } = useData<Invoice>('invoices');
  const { settings } = useSettings();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  useEffect(() => {
    if (invoices.length > 0 && id) {
      const inv = invoices.find(i => i.id === id);
      if (inv) setInvoice(inv);
    }
  }, [invoices, id]);

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    );
  }

  // Generate UPI URI if bank details exist, or a generic placeholder
  // UPI Format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&cu=CURRENCY&tn=TRANSACTION_NOTE
  const upiId = settings?.bankDetails?.upiId || 'payment@upi';
  const merchantName = settings?.companyName || 'Merchant';
  const amount = invoice.totalAmount.toFixed(2);
  const note = `Payment for Invoice ${invoice.invoiceNumber}`;
  const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

  const handleManualConfirm = async () => {
    setIsMarkingPaid(true);
    try {
      await updateItem(invoice.id, { status: 'Paid' });
      toast.success('Invoice marked as paid!');
      navigate('/invoices');
    } catch (err) {
      toast.error('Failed to update invoice status');
    } finally {
      setIsMarkingPaid(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Button variant="ghost" className="gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> Back to Invoices
      </Button>

      <Card className="border-none shadow-2xl overflow-hidden rounded-3xl bg-white">
        <CardHeader className="bg-[#237227] text-white p-8 pb-12">
          <div className="flex justify-between items-start mb-4">
            <Badge className="bg-white/20 text-white border-none font-bold uppercase text-[10px] tracking-widest">Digital Payment</Badge>
            <ShieldCheck className="w-6 h-6 opacity-40" />
          </div>
          <CardTitle className="text-3xl font-black tracking-tighter">
            {formatCurrency(invoice.totalAmount, invoice.currency)}
          </CardTitle>
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest mt-1">Invoice #{invoice.invoiceNumber}</p>
        </CardHeader>
        
        <CardContent className="p-8 -mt-6 bg-white rounded-t-3xl space-y-8 relative">
          <div className="flex flex-col items-center">
            <div className="p-6 bg-slate-50 rounded-3xl mb-4 border border-slate-100 shadow-inner">
              <QRCodeSVG 
                value={upiUri} 
                size={200}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "/favicon.ico",
                  x: undefined,
                  y: undefined,
                  height: 40,
                  width: 40,
                  excavate: true,
                }}
              />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scan with any UPI App to Pay</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400 uppercase tracking-widest">Beneficiary</span>
              <span className="text-slate-900">{merchantName}</span>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400 uppercase tracking-widest">UPI ID</span>
              <span className="text-slate-900">{upiId}</span>
            </div>
          </div>

          <div className="space-y-3">
             <Button 
               className="w-full h-12 bg-[#237227] hover:bg-[#1B561E] rounded-xl font-bold text-xs uppercase tracking-widest gap-2 shadow-lg shadow-[#237227]/20"
               onClick={handleManualConfirm}
               disabled={isMarkingPaid}
             >
               {isMarkingPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
               Confirm Payment Received
             </Button>
             <p className="text-[9px] text-center text-slate-400 font-medium px-4">
               Once payment is completed on your app, click confirm to update your records.
             </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-6 opacity-30">
        <CreditCard className="w-8 h-8 text-slate-400" />
        <span className="font-bold text-[10px] uppercase tracking-[0.2em] text-slate-400">Secure UPI Protocol</span>
      </div>
    </div>
  );
}
