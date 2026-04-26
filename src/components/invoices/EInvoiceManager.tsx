import React, { useState } from 'react';
import { 
  FileJson, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Loader2,
  X,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { BusinessSettings, Invoice } from '@/types';
import { generateEInvoiceJSON } from '@/lib/einvoice-generator';
import { EInvoiceService } from '@/services/einvoice-api';
import { toast } from 'sonner';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface EInvoiceManagerProps {
  invoice: Invoice;
  settings: BusinessSettings;
  onUpdate: (updatedInvoice: Invoice) => void;
  onClose: () => void;
}

export function EInvoiceManager({ invoice, settings, onUpdate, onClose }: EInvoiceManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleDownloadJSON = () => {
    try {
      const json = generateEInvoiceJSON(invoice, settings);
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `EInvoice-${invoice.invoiceNumber}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('E-Invoice JSON downloaded for portal upload');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate E-Invoice JSON');
    }
  };

  const handleApiRegistration = async () => {
    setIsRegistering(true);
    try {
      const response = await EInvoiceService.registerInvoice(invoice, settings);
      
      if (response.success && response.irn) {
        const updates: Partial<Invoice> = {
          ackNo: response.ackNo || '',
          ackDate: response.ackDate || '',
          irn: response.irn || '',
          signedQrCode: response.signedQrCode || '',
          einvoiceStatus: 'Generated'
        };

        await updateDoc(doc(db, 'invoices', invoice.id), updates);
        onUpdate({ ...invoice, ...updates });
        toast.success('E-Invoice registered successfully via API');
        onClose();
      } else {
        throw new Error(response.error || 'Failed to register with GSTN');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'API Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const text = await file.text();
      const portalResponse = JSON.parse(text);

      const updates: Partial<Invoice> = {
        ackNo: portalResponse.ackNo || portalResponse.AckNo || '',
        ackDate: portalResponse.ackDate || portalResponse.AckDt || portalResponse.irnDate || '',
        irn: portalResponse.irn || portalResponse.Irn || '',
        signedQrCode: portalResponse.signedQrCode || portalResponse.SignedQrCode || '',
        einvoiceStatus: 'Generated'
      };

      if (!updates.irn) {
        throw new Error('Invalid JSON: IRN not found in the uploaded file');
      }

      await updateDoc(doc(db, 'invoices', invoice.id), updates);
      onUpdate({ ...invoice, ...updates });
      toast.success('E-Invoice details updated from portal file');
      onClose();
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Failed to process portal response');
      toast.error('Error processing JSON file');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg animate-in fade-in zoom-in duration-200 border-none shadow-2xl">
        <CardHeader className="border-b bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-indigo-900">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
              GST E-Invoice System
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription>
            Register invoice {invoice.invoiceNumber} with the GST Network (v1.1)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* API Method - Recommended */}
          <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-indigo-900">Automated API Registration</h4>
                <p className="text-xs text-indigo-700/70 mt-1 leading-relaxed">
                  Recommended: Instantly register your invoice and generate IRN/QR code via the direct GST channel.
                </p>
              </div>
            </div>
            <Button 
              onClick={handleApiRegistration} 
              disabled={isRegistering}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-indigo-100"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting to GSTN...
                </>
              ) : (
                'Push to GST Network & Generate IRN'
              )}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-dashed" /></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-slate-400 bg-white px-2">OR MANUAL METHOD</div>
          </div>

          {/* Manual Method */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center text-center">
              <Download className="w-6 h-6 text-slate-400 mb-2" />
              <h5 className="text-[10px] font-black uppercase tracking-widest mb-2">Step 1</h5>
              <Button variant="outline" size="sm" onClick={handleDownloadJSON} className="w-full text-[10px] h-8">
                Download JSON
              </Button>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center text-center">
              <Upload className="w-6 h-6 text-slate-400 mb-2" />
              <h5 className="text-[10px] font-black uppercase tracking-widest mb-2">Step 2</h5>
              <div className="w-full">
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" id="portal-upload-manual" />
                <Button 
                  onClick={() => document.getElementById('portal-upload-manual')?.click()}
                  variant="outline" 
                  size="sm" 
                  className="w-full text-[10px] h-8"
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Upload Signed'}
                </Button>
              </div>
            </div>
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {uploadError}
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-slate-50 border-t p-4 rounded-b-lg">
          <div className="flex items-center justify-between w-full">
            <p className="text-[9px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Secure GSTN Proxy v1.1 Active
            </p>
            {!(import.meta as any).env.VITE_GST_CLIENT_ID && (
              <Badge variant="outline" className="text-[8px] bg-amber-50 text-amber-600 border-amber-200">Simulation Mode</Badge>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

