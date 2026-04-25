import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  FileText, 
  Package, 
  Users, 
  ReceiptIndianRupee, 
  Settings as SettingsIcon, 
  TrendingUp,
  Menu,
  X,
  CreditCard,
  Monitor,
  Globe,
  Dna,
  Zap,
  Plus,
  LogOut,
  Bell,
  ShieldCheck,
  Shield,
  Eye
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { useTranslation } from '@/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Shell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { t, language, setLanguage } = useTranslation();
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { icon: LayoutDashboard, label: t('dashboard'), path: '/' },
    { icon: Monitor, label: 'POS Terminal', path: '/pos' },
    { icon: FileText, label: t('invoices'), path: '/invoices' },
    { icon: Package, label: t('products'), path: '/products' },
    { icon: Users, label: t('clients'), path: '/clients' },
    { icon: ReceiptIndianRupee, label: t('expenses'), path: '/expenses' },
    { icon: Dna, label: 'Reconciliation', path: '/reconciliation' },
    { icon: TrendingUp, label: t('reports'), path: '/reports' },
    { icon: SettingsIcon, label: t('settings'), path: '/settings' },
  ];

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-[#237227] bg-[#D1FFD4] px-1.5 py-0.5 rounded-full"><ShieldCheck className="w-2.5 h-2.5" /> Admin</div>;
      case 'billing':
        return <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full"><Shield className="w-2.5 h-2.5" /> Billing</div>;
      default:
        return <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full"><Shield className="w-2.5 h-2.5" /> Billing</div>;
    }
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'ta', name: 'தமிழ்' },
    { code: 'te', name: 'తెలుగు' }
  ];

  const quickActions = [
    { icon: FileText, label: 'New Invoice', path: '/invoices', state: { create: true }, roles: ['admin', 'billing'] },
    { icon: Users, label: 'New Client', path: '/clients', roles: ['admin', 'billing'] },
    { icon: Package, label: 'New Product', path: '/products', roles: ['admin', 'billing'] },
    { icon: ReceiptIndianRupee, label: 'Record Expense', path: '/expenses', roles: ['admin', 'billing'] },
  ].filter(action => !action.roles || (profile && action.roles.includes(profile.role)));

  return (
    <div className="flex h-screen bg-[#f8fafc] text-[#1e293b] font-sans antialiased overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-60 bg-[#237227] text-white/70 flex-shrink-0 transition-all border-r border-[#1B561E]">
        <div className="p-8 pb-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-white tracking-tight">ZEONE</h1>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-tighter mt-1">v1.4.0 • CLOUD ACTIVE</p>
          </div>
        </div>
        
        <ScrollArea className="flex-1 mt-4">
          <nav className="flex flex-col">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-8 py-3 text-sm font-medium transition-all relative",
                  isActive 
                    ? "bg-[#1B561E] text-[#FFAA00]" 
                    : "hover:bg-[#1B561E] hover:text-white"
                )}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    <div className={cn(
                      "absolute right-0 top-0 bottom-0 w-1 bg-[#FFAA00] transition-opacity",
                      isActive ? "opacity-100" : "opacity-0"
                    )} />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-6 mt-auto border-t border-white/10 flex items-center justify-between">
           <div className="text-[10px] uppercase tracking-widest opacity-50 text-white">
             Zeone Billing
           </div>
           {profile?.role === 'admin' && <ShieldCheck className="w-3 h-3 text-[#FFAA00]" />}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-[#e2e8f0] flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden text-[#64748b] shrink-0" 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 sm:gap-4 truncate">
              <h2 className="text-sm sm:text-lg font-semibold tracking-tight truncate">Zeone Billing</h2>
              <div className="hidden sm:flex items-center gap-2 text-[12px] text-[#10b981] font-medium">
                <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                Cloud Real-time
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2 px-2 sm:px-3 text-slate-600 hover:text-slate-900 outline-none")}>
                <Globe className="w-4 h-4" />
                <span className="uppercase text-[10px] font-bold hidden xs:inline">{language}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                {languages.map((lang) => (
                  <DropdownMenuItem 
                    key={lang.code}
                    className={cn("text-xs cursor-pointer font-bold", language === lang.code && "bg-slate-100")}
                    onClick={() => setLanguage(lang.code as any)}
                  >
                    {lang.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {quickActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className={cn(buttonVariants({ size: "sm" }), "bg-[#FFAA00] text-white px-3 sm:px-4 rounded-lg text-sm font-medium hover:bg-[#FFAA00]/90 shadow-sm border-b-2 border-orange-700 gap-2 outline-none")}>
                  <Plus className="w-4 h-4" />
                  <span className="hidden xs:inline">Action</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl border-slate-100">
                  <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Creation Tools</div>
                  <DropdownMenuSeparator />
                  {quickActions.map((action) => (
                    <DropdownMenuItem 
                      key={action.label} 
                      className="gap-3 py-2.5 cursor-pointer font-bold text-xs uppercase tracking-wider"
                      onClick={() => navigate(action.path, { state: action.state })}
                    >
                      <action.icon className="w-4 h-4 text-[#237227]" /> {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-100 outline-none">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-black text-slate-800 leading-none mb-1">{profile?.displayName || 'User'}</div>
                  {getRoleBadge(profile?.role)}
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-[#FFD786] border-2 border-white shadow-md ring-1 ring-slate-100 flex items-center justify-center">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] sm:text-xs font-black text-[#237227]">{profile?.displayName?.charAt(0) || 'U'}</span>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl border-slate-100">
                <div className="px-4 py-2 border-b border-slate-50 mb-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Account</div>
                  <div className="text-xs font-bold text-slate-600 truncate">{profile?.email}</div>
                  <div className="sm:hidden mt-2">{getRoleBadge(profile?.role)}</div>
                </div>
                <DropdownMenuItem className="gap-3 py-3 cursor-pointer font-bold text-xs uppercase tracking-wider" onClick={() => navigate('/settings')}>
                  <SettingsIcon className="w-4 h-4 text-slate-400" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-3 py-3 cursor-pointer font-bold text-xs uppercase tracking-wider text-red-600 focus:text-red-600" onClick={logout}>
                  <LogOut className="w-4 h-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-[#fdfdfd]">
          <Outlet />
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
          <aside 
            className="w-64 h-full bg-[#237227] shadow-2xl flex flex-col text-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 pb-4 flex items-center justify-between">
              <div className="font-bold text-xl text-white tracking-tight">ZEONE</div>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)} className="text-white/60 hover:bg-[#1B561E]">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="flex-1 mt-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-8 py-3 text-sm font-medium transition-all relative",
                    isActive 
                      ? "bg-[#1B561E] text-[#FFAA00]" 
                      : "hover:bg-[#1B561E] hover:text-white"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                      <div className={cn(
                        "absolute right-0 top-0 bottom-0 w-1 bg-[#FFAA00] transition-opacity",
                        isActive ? "opacity-100" : "opacity-0"
                      )} />
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}
