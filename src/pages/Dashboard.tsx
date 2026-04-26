import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Package, 
  ReceiptIndianRupee,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useData } from '@/hooks/useData';
import { useTranslation } from '@/contexts/LanguageContext';
import { Invoice, Client, Item } from '@/types';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: invoices } = useData<Invoice>('invoices');
  const { data: clients } = useData<Client>('clients');
  const { data: items } = useData<Item>('items');

  const totalSales = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalGst = invoices.reduce((acc, inv) => acc + inv.totalCgst + inv.totalSgst, 0);
  const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((acc, inv) => acc + inv.totalAmount, 0);
  const outstanding = totalSales - totalPaid;

  // Real chart data from actual months
  const chartData = invoices.reduce((acc: any[], inv) => {
    const month = new Date(inv.date).toLocaleString('default', { month: 'short' });
    const existing = acc.find(d => d.name === month);
    if (existing) {
      existing.revenue += inv.totalAmount;
    } else {
      acc.push({ name: month, revenue: inv.totalAmount });
    }
    return acc;
  }, []).slice(-7);

  // If no data, show placeholders
  const displayChartData = chartData.length > 0 ? chartData : [
    { name: 'Mon', revenue: 0 },
    { name: 'Tue', revenue: 0 },
    { name: 'Wed', revenue: 0 },
    { name: 'Thu', revenue: 0 },
    { name: 'Fri', revenue: 0 },
    { name: 'Sat', revenue: 0 },
    { name: 'Sun', revenue: 0 },
  ];

  const stats = [
    { label: t('total_sales'), value: `₹${totalSales.toLocaleString()}`, icon: TrendingUp, delta: '+12.5%', isPos: true, color: 'text-[#237227]' },
    { label: t('outstanding'), value: `₹${outstanding.toLocaleString()}`, icon: ReceiptIndianRupee, delta: '-2.4%', isPos: false, color: 'text-[#FFAA00]' },
    { label: t('clients'), value: clients.length.toString(), icon: Users, delta: '+3', isPos: true, color: 'text-[#519A66]' },
    { label: t('products'), value: items.length.toString(), icon: Package, delta: '+5', isPos: true, color: 'text-[#FFD786] bg-[#237227]' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('dashboard')}</h2>
        <p className="text-[#666666] text-sm italic serif">{t('welcome')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-[#E5E5E5] shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-bold text-[#666666] uppercase truncate pr-4">
                {stat.label}
              </CardTitle>
              <stat.icon className={cn("h-4 w-4", stat.color?.includes('text-') ? stat.color : "text-[#999999]")} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black font-mono tracking-tighter">{stat.value}</div>
              <div className={cn(
                "flex items-center text-[10px] font-black mt-1",
                stat.isPos ? "text-[#237227]" : "text-[#FFAA00]"
              )}>
                {stat.isPos ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                {stat.delta}
                <span className="text-[#999999] font-normal ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-[#E5E5E5] shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#666666]">
              Revenue Stream
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#999999' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#999999' }}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F5F5F4' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E5E5', boxShadow: 'none' }}
                  />
                  <Bar 
                    dataKey="revenue" 
                    fill="#237227" 
                    radius={[4, 4, 0, 0]}
                    barSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-[#E5E5E5] shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#666666]">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {invoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex items-center">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{invoice.clientName}</p>
                    <p className="text-xs text-[#999999] font-mono">{invoice.invoiceNumber}</p>
                  </div>
                  <div className="ml-auto font-bold text-sm">
                    +₹{invoice.totalAmount.toLocaleString()}
                  </div>
                </div>
              ))}
              {invoices.length === 0 && (
                <div className="text-center py-8 text-[#999999] text-sm">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
