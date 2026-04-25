import React, { useState, useRef } from 'react';
import { useData } from '@/hooks/useData';
import { Expense } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, CheckCircle2, XCircle, AlertCircle, Search, Dna } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';

interface SupplierData {
  date: string;
  description: string;
  amount: number;
  id?: string;
  status?: 'Matched' | 'Missing' | 'Mismatch';
  matchedId?: string;
}

export default function Reconciliation() {
  const { data: expenses } = useData<Expense>('expenses');
  const [supplierRecords, setSupplierRecords] = useState<SupplierData[]>([]);
  const [isReconciling, setIsReconciling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data.map((row: any) => ({
          date: row.date || row.Date || '',
          description: row.description || row.Description || row.Details || '',
          amount: Number(row.amount || row.Amount || 0),
          id: Math.random().toString(36).substr(2, 9)
        }));
        setSupplierRecords(data);
        toast.success(`Imported ${data.length} records`);
      },
      error: () => toast.error('CSV Parsing failed')
    });
  };

  const startReconciliation = () => {
    setIsReconciling(true);
    const updated = supplierRecords.map(record => {
      // Simple matching logic: exact amount and similar date (within 3 days)
      const match = expenses.find(exp => 
        Math.abs(exp.amount - record.amount) < 0.01 && 
        (new Date(exp.date).getTime() - new Date(record.date).getTime()) / (1000 * 3600 * 24) <= 3
      );

      if (match) {
        return { ...record, status: 'Matched' as const, matchedId: match.id };
      } else {
        return { ...record, status: 'Missing' as const };
      }
    });

    setTimeout(() => {
      setSupplierRecords(updated);
      setIsReconciling(false);
      toast.success('Reconciliation Complete');
    }, 1500);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Matched': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-2 py-0.5"><CheckCircle2 className="w-3 h-3 mr-1" /> Matched</Badge>;
      case 'Missing': return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none px-2 py-0.5"><XCircle className="w-3 h-3 mr-1" /> Missing in Books</Badge>;
      case 'Mismatch': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-2 py-0.5"><AlertCircle className="w-3 h-3 mr-1" /> Mismatch</Badge>;
      default: return <Badge variant="outline" className="text-slate-400 border-slate-200">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Dna className="w-6 h-6 text-indigo-600" /> GSTR-2A Reconciliation
          </h2>
          <p className="text-[#666666] text-sm serif italic">Sync purchase invoices with GSTR-2A/2B supplier data</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" /> Upload Statement
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
          <Button 
            size="sm" 
            className="bg-black text-white gap-2" 
            onClick={startReconciliation} 
            disabled={supplierRecords.length === 0 || isReconciling}
          >
            {isReconciling ? 'Matching...' : 'Run Reconciliation'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-indigo-600 tracking-widest font-bold">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-indigo-900">{supplierRecords.length}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-emerald-600 tracking-widest font-bold">Matched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-900">
              {supplierRecords.filter(r => r.status === 'Matched').length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-rose-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-rose-600 tracking-widest font-bold">Missing in Books</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-rose-900">
              {supplierRecords.filter(r => r.status === 'Missing').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E5E5E5] shadow-none overflow-hidden">
        <CardHeader className="border-b border-[#F0F0F0] bg-[#FAFAFA]/50">
          <div className="flex justify-between items-center">
            <div>
               <CardTitle className="text-sm font-bold uppercase tracking-wider">Statement Data</CardTitle>
               <CardDescription className="text-xs">Comparison between Supplier records and Internal records</CardDescription>
            </div>
            <div className="flex items-center gap-2">
               <Input className="h-8 w-48 text-xs" placeholder="Filter records..." />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#FAFAFA]">
              <TableRow className="hover:bg-transparent border-[#F0F0F0]">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-[#999999]">Date</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-[#999999]">Description</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-[#999999] text-right">Amount</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-[#999999] text-center">Status</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-[#999999] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplierRecords.map((record) => (
                <TableRow key={record.id} className="group border-[#F0F0F0] hover:bg-[#FAFAFA]/40 transition-colors">
                  <TableCell className="text-xs font-medium font-mono">{record.date}</TableCell>
                  <TableCell className="text-xs font-bold text-slate-800">{record.description}</TableCell>
                  <TableCell className="text-xs text-right font-black">₹{record.amount.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(record.status)}</TableCell>
                  <TableCell className="text-right">
                    {record.status === 'Missing' && (
                      <Button variant="link" className="text-[10px] h-auto p-0 text-indigo-600">
                        Create Expense
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {supplierRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-[#999999] text-sm">
                    No statement records uploaded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
