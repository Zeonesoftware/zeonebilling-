import React, { useState, useRef } from 'react';
import { useData } from '@/hooks/useData';
import { useRBAC } from '@/hooks/useRBAC';
import { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, MoreHorizontal, FileEdit, Trash2, Upload } from 'lucide-react';
import { ClientForm } from '@/components/clients/ClientForm';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export default function Clients() {
  const { canCreate, canEdit, canDelete } = useRBAC();
  const { data: clients, loading, addItem, updateItem, deleteItem } = useData<Client>('clients');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const loadingToast = toast.loading(`Importing ${results.data.length} clients...`);
          const importedData = results.data.map((row: any) => ({
            name: row.name || 'Unnamed Client',
            gstin: row.gstin || '',
            stateCode: row.stateCode || '',
            email: row.email || '',
            phone: row.phone || '',
            address: row.address || ''
          }));

          for (const item of importedData) {
            await addItem(item);
          }

          toast.dismiss(loadingToast);
          toast.success('Import successful');
        } catch (err) {
          toast.error('Import failed');
        }
      }
    });
  };

  const handleSave = async (data: Partial<Client>) => {
    try {
      if (editingClient) {
        await updateItem(editingClient.id, data);
        toast.success('Client updated');
      } else {
        await addItem(data);
        toast.success('Client added');
      }
      setIsFormOpen(false);
      setEditingClient(null);
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Client Ledger</h2>
          <p className="text-[#666666] text-sm serif italic">Manage customers and outstanding balances</p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" /> Import CSV
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleCsvImport} accept=".csv" />
              <Button size="sm" className="bg-[#237227] hover:bg-[#1B561E] gap-2" onClick={() => setIsFormOpen(true)}>
                <Plus className="w-4 h-4" /> Add Client
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-[#FAFAFA]">
            <TableRow>
              <TableHead className="font-mono text-[10px] uppercase">Client Name</TableHead>
              <TableHead className="hidden sm:table-cell font-mono text-[10px] uppercase">GSTIN</TableHead>
              <TableHead className="font-mono text-[10px] uppercase">Phone</TableHead>
              <TableHead className="hidden lg:table-cell font-mono text-[10px] uppercase">Address</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12">Loading...</TableCell></TableRow>
            ) : clients.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12">No clients found</TableCell></TableRow>
            ) : clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="font-medium text-xs sm:text-sm">{client.name}</div>
                  <div className="sm:hidden text-[10px] font-mono text-slate-400">
                    {client.gstin} {client.stateCode && `(${client.stateCode})`}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell font-mono text-xs">
                  {client.gstin} {client.stateCode && <span className="text-slate-400 ml-1">[{client.stateCode}]</span>}
                </TableCell>
                <TableCell className="text-xs sm:text-sm">{client.phone}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-[#666666] truncate max-w-xs">{client.address}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#999999]">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && (
                        <DropdownMenuItem className="gap-2" onClick={() => { setEditingClient(client); setIsFormOpen(true); }}>
                          <FileEdit className="w-4 h-4" /> Edit
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem className="gap-2 text-red-600" onClick={() => deleteItem(client.id)}>
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

      <ClientForm 
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingClient(null); }}
        onSave={handleSave}
        client={editingClient}
      />
    </div>
  );
}
