import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  AlertCircle, 
  FileText, 
  Loader2, 
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Invoice, BusinessSettings } from '@/types';
import { generateEInvoiceJSON } from '@/lib/einvoice-generator';
import { toast } from 'sonner';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface BulkEInvoiceManagerProps {
  selectedInvoices: Invoice[];
  settings: BusinessSettings;
  onComplete: () => void;
  onClose: () => void;
}

export function BulkEInvoiceManager({ selectedInvoices, settings, onComplete, onClose }: BulkEInvoiceManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [updateResults, setUpdateResults] = useState<{ success: number; failed: number } | null>(null);

  const handleDownloadBulkJSON = () => {
    try {
      const bulkData = selectedInvoices.map(inv => generateEInvoiceJSON(inv, settings));
      const blob = new Blob([JSON.stringify(bulkData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bulk_EInvoice_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Bulk JSON for ${selectedInvoices.length} invoices downloaded`);
    } catch (err) {
      toast.error('Failed to generate bulk JSON');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUpdateResults(null);

    try {
      const text = await file.text();
      const signedData = JSON.parse(text);
      
      const responseArray = Array.isArray(signedData) ? signedData : [signedData];
      let successCount = 0;
      let failedCount = 0;

      for (const response of responseArray) {
        // Match response to invoice using invoiceNumber (DocDtls.No or No or invoiceNumber)
        const invoiceNum = response.DocDtls?.No || response.No || response.invoiceNumber || response.Irn; // Irn is not unique but sometimes used as key
        
        // Find matching local invoice
        const matchedInvoice = selectedInvoices.find(inv => 
          inv.invoiceNumber === invoiceNum || 
          (response.Irn && response.Irn === inv.irn)
        );

        if (matchedInvoice) {
          const updates: Partial<Invoice> = {
            ackNo: response.ackNo || response.AckNo || '',
            ackDate: response.ackDate || response.AckDt || response.irnDate || '',
            irn: response.irn || response.Irn || '',
            signedQrCode: response.signedQrCode || response.SignedQrCode || '',
            einvoiceStatus: 'Generated',
            updatedAt: new Date().toISOString(),
            updatedBy: auth.currentUser?.email || 'System'
          };

          try {
            await updateDoc(doc(db, 'invoices', matchedInvoice.id), updates);
            successCount++;
          } catch (error) {
            console.error(`Failed to update invoice ${matchedInvoice.id}:`, error);
            failedCount++;
            // We don't call handleFirestoreError here to avoid breaking the bulk loop, but we log it
          }
        } else {
          console.warn('No matching invoice found for response:', invoiceNum);
          failedCount++;
        }
      }

      setUpdateResults({ success: successCount, failed: failedCount });
      if (successCount > 0) {
        toast.success(`Updated ${successCount} invoices with E-Invoice details`);
      }
      if (failedCount > 0) {
        toast.warning(`${failedCount} documents in file did not match any selected invoices`);
      }
      
      if (successCount > 0 && failedCount === 0) {
        setTimeout(() => {
          onComplete();
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'Invalid JSON file format');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg animate-in fade-in zoom-in duration-200 border-none shadow-2xl overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-indigo-900 uppercase tracking-tighter font-black">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
              Bulk E-Invoice Portal
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="font-bold">
            Processing {selectedInvoices.length} selected documents
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          {updateResults ? (
            <div className="p-6 text-center space-y-4 animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 uppercase">Processing Complete</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  {updateResults.success} Successfully Updated
                  {updateResults.failed > 0 && ` | ${updateResults.failed} Failed / Not Matched`}
                </p>
              </div>
              <Button onClick={onClose} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest h-11 rounded-xl">
                Close Manager
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Download */}
              <div className="group relative p-5 bg-blue-50/50 rounded-2xl border-2 border-dashed border-blue-200 hover:border-blue-400 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-black shadow-lg shadow-blue-200">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-blue-900 text-sm uppercase">Generate Portal JSON</h4>
                    <p className="text-[10px] text-blue-700 font-bold mt-1 leading-relaxed">
                      Download a single bulk JSON file containing all selected {selectedInvoices.length} invoices formatted for the GePP tool or bulk portal upload.
                    </p>
                    <Button 
                      onClick={handleDownloadBulkJSON}
                      variant="outline"
                      className="mt-4 w-full bg-white border-blue-200 text-blue-700 hover:bg-blue-100 font-black text-[10px] uppercase tracking-widest h-10 shadow-sm"
                    >
                      <Download className="w-3 h-3 mr-2" /> Download Bulk Payload
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-center -my-3 relative z-10">
                <div className="bg-white p-1 rounded-full border shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                    <div className="w-0.5 h-3 bg-slate-400 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Step 2: Upload */}
              <div className="group relative p-5 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 font-black shadow-lg shadow-indigo-200 text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-indigo-900 text-sm uppercase">Import Signed Response</h4>
                    <p className="text-[10px] text-indigo-700 font-bold mt-1 leading-relaxed">
                      After the portal processes your file, upload the *signed* bulk JSON response. We will automatically update IRNs and QR codes.
                    </p>
                    <div className="mt-4">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="bulk-signed-upload"
                        disabled={isUploading}
                      />
                      <Button 
                        onClick={() => document.getElementById('bulk-signed-upload')?.click()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest h-10 shadow-lg shadow-indigo-100"
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                            Processing Responses...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3 h-3 mr-2" /> 
                            Upload Signed JSON
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 animate-in shake duration-300">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <p className="text-[10px] text-red-700 font-bold uppercase">{uploadError}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="bg-slate-50 p-4 border-t">
          <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            Compliant with GST E-Invoice Schema v1.1
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
