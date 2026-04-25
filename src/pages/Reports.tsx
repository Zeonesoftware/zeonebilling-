import React from 'react';
import { useData } from '@/hooks/useData';
import { Invoice, Expense } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

export default function Reports() {
  const { data: invoices } = useData<Invoice>('invoices');
  const { data: expenses } = useData<Expense>('expenses');

  const totalSales = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalExpenses = expenses.reduce((acc, i) => acc + i.amount, 0);
  const totalCgst = invoices.reduce((acc, i) => acc + i.totalCgst, 0);
  const totalSgst = invoices.reduce((acc, i) => acc + i.totalSgst, 0);
  const totalGst = totalCgst + totalSgst;

  const profitLossData = [
    { name: 'Income', amount: totalSales, fill: '#237227' },
    { name: 'Expenses', amount: totalExpenses, fill: '#FFAA00' },
    { name: 'Net Profit', amount: totalSales - totalExpenses, fill: '#519A66' },
  ];

  const gstData = [
    { name: 'CGST Collected', value: totalCgst },
    { name: 'SGST Collected', value: totalSgst },
  ];

  const COLORS = ['#237227', '#FFAA00', '#519A66', '#FFD786', '#1B561E', '#E69900'];

  const categoryData = expenses.reduce((acc: any[], exp) => {
    const existing = acc.find(a => a.name === exp.category);
    if (existing) {
      existing.value += exp.amount;
    } else {
      acc.push({ name: exp.category, value: exp.amount });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Business Analytics</h2>
          <p className="text-[#666666] text-sm serif italic">GST reports and financial summaries</p>
        </div>
        <Button className="bg-black text-white hover:bg-black/90 uppercase text-[10px] tracking-widest font-bold h-10 px-6">
          Export FY 2024-25 Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Revenue', value: totalSales, color: 'text-slate-900' },
          { label: 'Tax Collected', value: totalGst, color: 'text-[#237227]' },
          { label: 'Operating Costs', value: totalExpenses, color: 'text-[#FFAA00]' },
          { label: 'Net Margin', value: totalSales - totalExpenses, color: 'text-[#519A66]' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-black ${stat.color}`}>₹{stat.value.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-[#E5E5E5] shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-widest text-[#666666]">Profit & Loss Projection</CardTitle>
            <CardDescription className="text-xs">Visualizing income vs overheads</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitLossData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip cursor={{ fill: '#F5F5F4' }} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={60}>
                  {profitLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-[#E5E5E5] shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-widest text-[#666666]">Expense Categories</CardTitle>
            <CardDescription className="text-xs">Where your money is going</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-[#E5E5E5] shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-widest text-[#666666]">GSTR-1 Tax Summary</CardTitle>
            <CardDescription className="text-xs">Breakdown of GST collected from sales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
               <div className="p-4 bg-[#237227]/5 rounded-lg border border-[#237227]/10">
                  <div className="text-[10px] font-bold text-[#237227]/60 uppercase mb-1">Total CGST</div>
                  <div className="text-xl font-black text-[#237227]">₹{totalCgst.toLocaleString('en-IN')}</div>
               </div>
               <div className="p-4 bg-[#519A66]/5 rounded-lg border border-[#519A66]/10">
                  <div className="text-[10px] font-bold text-[#519A66]/60 uppercase mb-1">Total SGST</div>
                  <div className="text-xl font-black text-[#519A66]">₹{totalSgst.toLocaleString('en-IN')}</div>
               </div>
            </div>
            <div className="p-6 border-2 border-dashed border-slate-100 rounded-xl flex justify-between items-center bg-[#FFD786]/10">
               <div className="space-y-1">
                 <div className="text-xs font-bold uppercase tracking-widest">Total GST Payable</div>
                 <div className="text-[10px] text-slate-400">Total collection (unadjusted)</div>
               </div>
               <div className="text-3xl font-black text-slate-900">₹{totalGst.toLocaleString('en-IN')}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E5E5E5] shadow-none bg-[#237227] text-white">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-widest opacity-60">GSTR-3B Input Credit</CardTitle>
            <CardDescription className="text-xs text-white/60">Estimated tax credit from purchases</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <div className="text-xs font-bold uppercase text-white/40">Total Purchases</div>
                <div className="text-lg font-black italic">₹{totalExpenses.toLocaleString('en-IN')}</div>
             </div>
             <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <div className="text-xs font-bold uppercase text-white/40">Avail. Input GST (Est)</div>
                <div className="text-2xl font-black text-[#FFAA00]">₹{(totalExpenses * 0.18).toLocaleString('en-IN')}</div>
             </div>
             <p className="text-[10px] text-white/40 italic">This is an estimate based on a weighted average of 18% GST across all expense categories.</p>
             <Button className="w-full bg-[#FFAA00] text-white hover:bg-[#FFAA00]/90 uppercase text-[10px] font-black h-12 border-b-2 border-orange-700">
               Download GSTR-3B Worksheet
             </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
