import React, { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { UserManagement } from '@/components/layout/UserManagement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save, Download, Upload, Cloud, Check, Building, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { settings, loading, updateSettings } = useSettings();
  const { profile } = useAuth();
  const [formData, setFormData] = useState<any>(null);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'business' | 'users'>('business');
  const [isUploading, setIsUploading] = useState(false);
  const [isSigUploading, setIsSigUploading] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const sigInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) setFormData(settings);
    const storedTokens = localStorage.getItem('google_tokens');
    if (storedTokens) {
      setGoogleUser(JSON.parse(storedTokens));
    }
  }, [settings]);

  const handleFileUpload = async (file: File, type: 'logo' | 'signature') => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    const setStatus = type === 'logo' ? setIsUploading : setIsSigUploading;
    setStatus(true);

    try {
      const storageRef = ref(storage, `business/${type}_${Date.now()}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      setFormData((prev: any) => ({ ...prev, [`${type}Url`]: url }));
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to upload ${type}`);
    } finally {
      setStatus(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, 'logo');
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, 'signature');
  };

  const removeLogo = () => {
    setFormData((prev: any) => ({ ...prev, logoUrl: '' }));
    toast.info('Logo removed. Save to apply.');
  };

  const removeSignature = () => {
    setFormData((prev: any) => ({ ...prev, signatureUrl: '' }));
    toast.info('Signature removed. Save to apply.');
  };

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        localStorage.setItem('google_tokens', JSON.stringify(tokens));
        setGoogleUser(tokens);
        toast.success('Connected to Google Drive');
      }
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const { url } = await res.json();
      window.open(url, 'google_auth', 'width=600,height=600');
    } catch (err) {
      toast.error('Failed to initiate Google connection');
    }
  };

  const handleDisconnectGoogle = () => {
    localStorage.removeItem('google_tokens');
    setGoogleUser(null);
    toast.success('Disconnected from Google');
  };

  const handleSave = async () => {
    try {
      await updateSettings(formData);
      toast.success('Settings updated successfully');
    } catch (err) {
      toast.error('Failed to update settings');
    }
  };

  const handleBackup = async () => {
    try {
      const collections = ['invoices', 'items', 'clients', 'expenses', 'settings'];
      const backupData: any = {};
      
      for (const col of collections) {
        const res = await fetch(`/api/data/${col}`);
        backupData[col] = await res.json();
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zeone-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Backup downloaded');
    } catch (err) {
      toast.error('Backup failed');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const collections = Object.keys(data);
        
        const loadingToast = toast.loading('Restoring data...');
        
        for (const col of collections) {
          await fetch(`/api/data/${col}/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data[col])
          });
        }
        
        toast.dismiss(loadingToast);
        toast.success('Restore successful');
        setTimeout(() => window.location.reload(), 1000); 
      } catch (err) {
        toast.error('Restore failed');
      }
    };
    reader.readAsText(file);
  };

  if (loading || !formData) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Configuration</h2>
          <p className="text-[#666666] text-sm serif italic">Manage your team and business preferences</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'business' && (
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleBackup}>
                <Download className="w-3 h-3" /> Backup Data
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3 h-3" /> Restore
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleRestore} accept=".json" />
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        <Button 
          variant={activeTab === 'business' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => setActiveTab('business')}
          className={cn("rounded-xl px-6 font-bold text-xs uppercase tracking-widest transition-all", activeTab === 'business' ? "bg-white shadow-sm" : "text-slate-500")}
        >
          Business
        </Button>
        {profile?.role === 'admin' && (
          <Button 
            variant={activeTab === 'users' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setActiveTab('users')}
            className={cn("rounded-xl px-6 font-bold text-xs uppercase tracking-widest transition-all", activeTab === 'users' ? "bg-white shadow-sm" : "text-slate-500")}
          >
            Team Members
          </Button>
        )}
      </div>

      {activeTab === 'users' ? (
        <UserManagement />
      ) : (
        <div className="grid gap-8">
          <Card className="border-[#E5E5E5] shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider">Company Details</CardTitle>
              <CardDescription>Basic information used for invoice headers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-100">
                <div className="flex gap-4">
                  <div className="relative group">
                    <div className={cn(
                      "w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 relative",
                      formData.logoUrl && "border-solid border-[#237227]"
                    )}>
                      {formData.logoUrl ? (
                        <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-[#237227]" />
                        </div>
                      )}
                    </div>
                    {formData.logoUrl && (
                      <button 
                        onClick={removeLogo}
                        className="absolute -top-2 -right-2 p-1 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 shadow-sm transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="relative group">
                    <div className={cn(
                      "w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 relative",
                      formData.signatureUrl && "border-solid border-[#237227]"
                    )}>
                      {formData.signatureUrl ? (
                        <img src={formData.signatureUrl} alt="Signature" className="w-full h-full object-contain p-2 mix-blend-multiply" />
                      ) : (
                        <Check className="w-8 h-8 text-slate-300" />
                      )}
                      {isSigUploading && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-[#237227]" />
                        </div>
                      )}
                    </div>
                    {formData.signatureUrl && (
                      <button 
                        onClick={removeSignature}
                        className="absolute -top-2 -right-2 p-1 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 shadow-sm transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-black tracking-widest text-slate-400">Identity & Branding</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2 rounded-xl"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <Upload className="w-3 h-3" /> Logo
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2 rounded-xl"
                        onClick={() => sigInputRef.current?.click()}
                        disabled={isSigUploading}
                      >
                        <Upload className="w-3 h-3" /> Signature
                      </Button>
                      <input 
                        type="file" 
                        ref={logoInputRef} 
                        className="hidden" 
                        onChange={handleLogoUpload} 
                        accept="image/*" 
                      />
                      <input 
                        type="file" 
                        ref={sigInputRef} 
                        className="hidden" 
                        onChange={handleSignatureUpload} 
                        accept="image/*" 
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 italic">Recommended: Images with white backgrounds or PNGs with transparency.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">Company Name</Label>
                  <Input value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">GSTIN</Label>
                  <Input value={formData.gstin} onChange={e => setFormData({ ...formData, gstin: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">State Code</Label>
                  <Input value={formData.stateCode} onChange={e => setFormData({ ...formData, stateCode: e.target.value })} placeholder="e.g. 27" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">Email</Label>
                  <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">Phone</Label>
                  <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-[#666666]">Full Address</Label>
                <Textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E5E5] shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider">Invoice Configuration</CardTitle>
              <CardDescription>Numbering and currency preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">Default Currency</Label>
                  <Select value={formData.currency || ""} onValueChange={v => setFormData({ ...formData, currency: v })}>
                    <SelectTrigger>
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
                  <Label className="text-xs uppercase font-bold text-[#666666]">Invoice Prefix</Label>
                  <Input value={formData.invoicePrefix} onChange={e => setFormData({ ...formData, invoicePrefix: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">Separator</Label>
                  <Input value={formData.invoiceSeparator} onChange={e => setFormData({ ...formData, invoiceSeparator: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">Zero Padding</Label>
                  <Input type="number" value={formData.invoicePadding} onChange={e => setFormData({ ...formData, invoicePadding: Number(e.target.value) })} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E5E5] shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider">Inventory & Alerts</CardTitle>
              <CardDescription>Configure stock tracking and low stock notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">Low Stock Threshold</Label>
                  <div className="flex items-center gap-4">
                    <Input 
                      type="number" 
                      value={formData.lowStockThreshold} 
                      onChange={e => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })} 
                      className="max-w-[120px]"
                    />
                    <span className="text-xs text-slate-500 italic">Mark items as 'Low Stock' when units fall below this value.</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E5E5] shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider">Banking & Payments</CardTitle>
              <CardDescription>Details for payment collection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">Bank Name</Label>
                  <Input value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">Account Number</Label>
                  <Input value={formData.accountNumber} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">IFSC Code</Label>
                  <Input value={formData.ifscCode} onChange={e => setFormData({ ...formData, ifscCode: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-[#666666]">UPI ID (Optional)</Label>
                  <Input value={formData.upiId} onChange={e => setFormData({ ...formData, upiId: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E5E5] shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-500" /> Google Apps Integration
              </CardTitle>
              <CardDescription>Connect your Google account to sync with Drive and send emails via Gmail</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[#FAFAFA] rounded-lg border border-[#EEEEEE]">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    googleUser ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                  )}>
                    {googleUser ? <Check className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold">
                      {googleUser ? "Connected to Google Workspace" : "Google Account Not Connected"}
                    </div>
                    <div className="text-[10px] text-[#999999] uppercase tracking-wider">
                      {googleUser ? "Drive Sync & Gmail Ready" : "Requires authentication"}
                    </div>
                  </div>
                </div>
                {googleUser ? (
                  <Button variant="outline" size="sm" onClick={handleDisconnectGoogle} className="text-red-600 hover:text-red-700">
                    Disconnect
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleConnectGoogle} className="gap-2">
                    <Cloud className="w-4 h-4" /> Connect Google
                  </Button>
                )}
              </div>

              {googleUser && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Auto-upload PDFs to Drive</Label>
                      <p className="text-xs text-[#666666]">Archive invoices automatically to your cloud storage</p>
                    </div>
                    <Switch 
                      checked={formData.autoUploadToDrive} 
                      onCheckedChange={(checked) => setFormData({ ...formData, autoUploadToDrive: checked })} 
                    />
                  </div>
                  <div className="flex items-center justify-between opacity-60">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Gmail Integration Active</Label>
                      <p className="text-xs text-[#666666]">You can now send invoices directly from the preview screen</p>
                    </div>
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#E5E5E5] shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider">Invoice Terms</CardTitle>
              <CardDescription>Standard terms and conditions</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                rows={4} 
                value={formData.terms} 
                onChange={e => setFormData({ ...formData, terms: e.target.value })} 
                className="font-mono text-xs"
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} className="bg-black text-white gap-2">
              <Save className="w-4 h-4" /> Save Configuration
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
