import React, { useMemo, useState } from 'react';
import { useData } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { Invoice, Expense, Purchase, Item } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
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
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { format, parseISO, startOfMonth, subMonths, eachMonthOfInterval, isWithinInterval, startOfYear, endOfYear, setMonth, setYear } from 'date-fns';
import { TrendingUp, ArrowUpRight, ArrowDownRight, IndianRupee, PieChart as PieChartIcon, Zap, ChevronDown, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Reports() {
  const { profile } = useAuth();
  const { data: invoices } = useData<Invoice>('invoices');
  const { data: expenses } = useData<Expense>('expenses');
  const { data: purchases } = useData<Purchase>('purchases');
  const { data: items } = useData<Item>('items');

  // Financial Year Selection
  const getCurrentFY = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed
    if (month < 4) return `${year - 1}-${year % 100}`;
    return `${year}-${(year + 1) % 100}`;
  };

  const [selectedFY, setSelectedFY] = useState(getCurrentFY());
  const [isExporting, setIsExporting] = useState(false);

  const financialYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
        const startYear = currentYear - i + (new Date().getMonth() < 3 ? -1 : 0);
        years.push(`${startYear}-${(startYear + 1) % 100}`);
    }
    return years;
  }, []);

  const getFYInterval = (fy: string) => {
    const [startYearStr] = fy.split('-');
    const startYear = parseInt(startYearStr);
    return {
      start: new Date(startYear, 3, 1), // April 1st
      end: new Date(startYear + 1, 2, 31, 23, 59, 59) // March 31st
    };
  };

  const fyInterval = useMemo(() => getFYInterval(selectedFY), [selectedFY]);

  const filteredInvoices = useMemo(() => 
    invoices.filter(i => isWithinInterval(parseISO(i.date), fyInterval)),
  [invoices, fyInterval]);

  const filteredExpenses = useMemo(() => 
    expenses.filter(e => isWithinInterval(parseISO(e.date), fyInterval)),
  [expenses, fyInterval]);

  const filteredPurchases = useMemo(() => 
    purchases.filter(p => isWithinInterval(parseISO(p.date), fyInterval)),
  [purchases, fyInterval]);

  // Basic Summaries
  const totalSales = useMemo(() => filteredInvoices.reduce((acc, i) => acc + i.totalAmount, 0), [filteredInvoices]);
  const totalExpenses = useMemo(() => filteredExpenses.reduce((acc, i) => acc + i.amount, 0), [filteredExpenses]);
  const totalPurchases = useMemo(() => filteredPurchases.reduce((acc, i) => acc + i.totalAmount, 0), [filteredPurchases]);
  
  const totalCgst = useMemo(() => filteredInvoices.reduce((acc, i) => acc + (i.totalCgst || 0), 0), [filteredInvoices]);
  const totalSgst = useMemo(() => filteredInvoices.reduce((acc, i) => acc + (i.totalSgst || 0), 0), [filteredInvoices]);
  const totalIgst = useMemo(() => filteredInvoices.reduce((acc, i) => acc + (i.totalIgst || 0), 0), [filteredInvoices]);
  const totalGstCollected = totalCgst + totalSgst + totalIgst;

  const totalCgstInput = useMemo(() => purchases.reduce((acc, i) => acc + (i.totalCgst || 0), 0), [purchases]);
  const totalSgstInput = useMemo(() => purchases.reduce((acc, i) => acc + (i.totalSgst || 0), 0), [purchases]);
  const totalIgstInput = useMemo(() => purchases.reduce((acc, i) => acc + (i.totalIgst || 0), 0), [purchases]);
  const totalGstITC = totalCgstInput + totalSgstInput + totalIgstInput;

  // Monthly Sales Trends (Selected FY)
  const monthlyTrendsData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: fyInterval.start,
      end: fyInterval.end < new Date() ? fyInterval.end : new Date()
    });

    return months.map(month => {
      const monthStr = format(month, 'MMM yyyy');
      const sales = filteredInvoices
        .filter(i => format(parseISO(i.date), 'MMM yyyy') === monthStr)
        .reduce((sum, i) => sum + i.totalAmount, 0);
      
      const purchaseAmount = filteredPurchases
        .filter(p => format(parseISO(p.date), 'MMM yyyy') === monthStr)
        .reduce((sum, p) => sum + p.totalAmount, 0);
      
      const expenseAmount = filteredExpenses
        .filter(e => format(parseISO(e.date), 'MMM yyyy') === monthStr)
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        name: format(month, 'MMM'),
        Revenue: sales,
        Costs: purchaseAmount + expenseAmount,
        Profit: sales - (purchaseAmount + expenseAmount)
      };
    });
  }, [filteredInvoices, filteredPurchases, filteredExpenses, fyInterval]);

  // Top Products by Revenue
  const topProductsData = useMemo(() => {
    const productSales: Record<string, number> = {};
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        productSales[item.name] = (productSales[item.name] || 0) + (item.price * item.quantity);
      });
    });

    return Object.entries(productSales)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredInvoices]);

  // Expense Category Pie Data
  const categoryData = useMemo(() => {
    const cats = filteredExpenses.reduce((acc: any[], exp) => {
      const existing = acc.find(a => a.name === exp.category);
      if (existing) {
        existing.value += exp.amount;
      } else {
        acc.push({ name: exp.category, value: exp.amount });
      }
      return acc;
    }, []);
    return cats.sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const handleExportAudit = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Generating audit file...');
    try {
      const headers = ['Date', 'Type', 'Number', 'Client', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Status'];
      const rows = filteredInvoices.map(inv => [
        inv.date,
        inv.type,
        inv.invoiceNumber,
        inv.clientName,
        inv.clientGstin || '',
        inv.subtotal.toFixed(2),
        (inv.totalCgst || 0).toFixed(2),
        (inv.totalSgst || 0).toFixed(2),
        (inv.totalIgst || 0).toFixed(2),
        inv.totalAmount.toFixed(2),
        inv.status
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Audit_Report_FY_${selectedFY}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Audit file exported successfully', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to export audit file', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const COLORS = ['#0F172A', '#237227', '#FFAA00', '#519A66', '#E2E8F0', '#94A3B8'];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-slate-900">Financial Insights</h2>
          <p className="text-slate-500 text-sm font-medium">Deep dive into your business performance and tax health.</p>
        </div>
        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-widest h-10 px-6 rounded-xl flex gap-2 items-center">
                FY {selectedFY}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 p-2 rounded-xl shadow-2xl border-slate-100">
              {financialYears.map(fy => (
                <DropdownMenuItem 
                  key={fy} 
                  onClick={() => setSelectedFY(fy)}
                  className="font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  FY {fy}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            onClick={handleExportAudit}
            disabled={isExporting}
            className="bg-slate-900 text-white hover:bg-black uppercase text-[10px] tracking-widest font-black h-10 px-6 rounded-xl shadow-lg shadow-slate-200 flex gap-2 items-center"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Audit File
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Net Revenue', value: totalSales, icon: IndianRupee, trend: '+12.5%', isUp: true, color: 'text-slate-900', bg: 'bg-slate-50' },
          { label: 'Tax Collected', value: totalGstCollected, icon: Zap, trend: '+8.2%', isUp: true, color: 'text-[#237227]', bg: 'bg-green-50/50' },
          { label: 'Monthly Burn', value: (totalExpenses + totalPurchases) / 12, icon: ArrowDownRight, trend: '-2.4%', isUp: false, color: 'text-[#FFAA00]', bg: 'bg-orange-50/50' },
          { label: 'Est. Net Profit', value: totalSales - totalExpenses - totalPurchases, icon: TrendingUp, trend: '+5.1%', isUp: true, color: 'text-[#519A66]', bg: 'bg-emerald-50/50' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-black rounded-full px-2 py-1 ${stat.isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {stat.trend}
                  {stat.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{stat.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black tracking-tight text-slate-900">₹{stat.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Monthly Trend Chart */}
        <Card className="lg:col-span-2 border-slate-100 shadow-none rounded-3xl p-2">
          <CardHeader className="px-6 pt-6">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-black tracking-tight text-slate-900">Revenue vs Costs</CardTitle>
                <CardDescription className="text-xs">Performance trajectory over the last 6 months</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                  <span className="text-[10px] font-bold uppercase text-slate-400">Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-bold uppercase text-slate-400">Costs</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-80 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendsData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Line type="monotone" dataKey="Revenue" stroke="#0F172A" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Costs" stroke="#10b981" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="border-slate-100 shadow-none rounded-3xl p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-base font-black tracking-tight text-slate-900">Top Revenue Drivers</CardTitle>
            <CardDescription className="text-xs">Highest contributing products</CardDescription>
          </CardHeader>
          <CardContent className="px-0 space-y-6 pt-4">
            {topProductsData.map((prod, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 border border-slate-100">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 leading-none mb-1">{prod.name}</div>
                    <div className="text-[10px] uppercase font-black text-emerald-500 tracking-tighter">
                      {((prod.value / totalSales) * 100).toFixed(1)}% Share
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-slate-900">₹{prod.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
            ))}
            {topProductsData.length === 0 && (
              <div className="text-center py-12 text-slate-400 italic text-sm">No sales data available yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Expense Category Breakdown */}
        <Card className="border-slate-100 shadow-none rounded-3xl p-2">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-base font-black tracking-tight text-slate-900">Expense Allocation</CardTitle>
            <CardDescription className="text-xs">Distribution across operating categories</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-3">
              {categoryData.slice(0, 4).map((cat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase truncate pr-2">{cat.name}</span>
                      <span className="text-[10px] font-black text-slate-900">{((cat.value / totalExpenses) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-50 h-1.5 rounded-full mt-1 overflow-hidden">
                       <div className="h-full rounded-full" style={{ width: `${(cat.value / totalExpenses) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tax Health Card */}
        <Card className="lg:col-span-2 border-none bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <PieChartIcon className="w-48 h-48 -mr-12 -mt-12" />
          </div>
          <CardHeader className="px-0 pt-0 relative z-10">
            <CardTitle className="text-base font-black tracking-tight text-white">GST Compliance Health</CardTitle>
            <CardDescription className="text-xs text-slate-400">Summary of tax obligations and credits</CardDescription>
          </CardHeader>
          <CardContent className="px-0 space-y-8 pt-4 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Output GST</div>
                    <div className="text-lg font-black text-emerald-400">₹{totalGstCollected.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Input ITC</div>
                    <div className="text-lg font-black text-orange-400">₹{totalGstITC.toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                   <div className="flex justify-between items-center mb-4">
                     <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Net Tax Liability</span>
                     <span className="text-2xl font-black text-white">₹{Math.max(0, totalGstCollected - totalGstITC).toLocaleString('en-IN')}</span>
                   </div>
                   <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-400" 
                        style={{ width: `${Math.min(100, (totalGstITC / (totalGstCollected || 1)) * 100)}%` }} 
                      />
                   </div>
                   <p className="text-[10px] text-slate-500 mt-3 font-medium">ITC offsets <span className="text-white font-black">{((totalGstITC / (totalGstCollected || 1)) * 100).toFixed(1)}%</span> of your tax liability.</p>
                </div>
              </div>

              {(profile?.role === 'admin' || profile?.permissions?.includes('quick_actions')) && (
                <div className="space-y-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Quick Actions</div>
                  <div className="grid gap-3">
                    <button className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 text-left group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-emerald-400" />
                          </div>
                          <span className="text-xs font-bold">Generate GSTR-1</span>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
                    </button>
                    <button className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 text-left group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-orange-400" />
                          </div>
                          <span className="text-xs font-bold">Claim Input Tax Credit</span>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
