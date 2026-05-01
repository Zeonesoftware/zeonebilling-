import React, { useState } from 'react';
import { Client } from '@/types';
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
import { Textarea } from '@/components/ui/textarea';

interface ClientFormProps {
  client?: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Partial<Client>) => void;
}

export function ClientForm({ client, isOpen, onClose, onSave }: ClientFormProps) {
  const [formData, setFormData] = React.useState<Partial<Client>>({
    name: '',
    gstin: '',
    stateCode: '',
    email: '',
    phone: '',
    address: ''
  });

  React.useEffect(() => {
    if (isOpen) {
      setFormData(client || {
        name: '',
        gstin: '',
        stateCode: '',
        email: '',
        phone: '',
        address: ''
      });
    }
  }, [client, isOpen]);

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{client ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-xs uppercase font-bold text-[#666666]">Client / Business Name</Label>
            <Input id="name" value={formData.name || ""} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="gstin" className="text-xs uppercase font-bold text-[#666666]">GSTIN</Label>
              <Input id="gstin" value={formData.gstin || ""} onChange={e => setFormData({ ...formData, gstin: e.target.value })} className="font-mono" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stateCode" className="text-xs uppercase font-bold text-[#666666]">State Code</Label>
              <Input id="stateCode" value={formData.stateCode || ""} onChange={e => setFormData({ ...formData, stateCode: e.target.value })} placeholder="e.g. 27" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-xs uppercase font-bold text-[#666666]">Email</Label>
              <Input id="email" type="email" value={formData.email || ""} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone" className="text-xs uppercase font-bold text-[#666666]">Phone</Label>
              <Input id="phone" value={formData.phone || ""} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address" className="text-xs uppercase font-bold text-[#666666]">Billing Address</Label>
            <Textarea id="address" value={formData.address || ""} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-black text-white hover:bg-black/90">Save Client</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
