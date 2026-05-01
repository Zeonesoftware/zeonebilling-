import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Dashboard from '@/pages/Dashboard';
import LoginPage from '@/pages/Login';

// Lazy load other pages
import Invoices from '@/pages/Invoices';
import Products from '@/pages/Products';
import Clients from '@/pages/Clients';
import Expenses from '@/pages/Expenses';
import POS from '@/pages/POS';
import Settings from '@/pages/Settings';
import Reports from '@/pages/Reports';
import PublicInvoiceView from '@/pages/PublicInvoiceView';
import Reconciliation from '@/pages/Reconciliation';
import Purchases from '@/pages/Purchases';
import Payment from '@/pages/Payment';
import GSTReturns from '@/pages/GSTReturns';

function ProtectedRoute({ children, allowedRoles, requiredPermission }: { children: React.ReactNode, allowedRoles?: string[], requiredPermission?: string }) {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#237227]"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" />; // Or a custom 403 page
  }

  if (requiredPermission && profile && profile.role !== 'admin' && !profile.permissions?.includes(requiredPermission)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route element={
              <ProtectedRoute>
                <Shell />
              </ProtectedRoute>
            }>
              <Route path="/" element={<Dashboard />} />
              <Route path="/invoices" element={
                <ProtectedRoute requiredPermission="invoices">
                  <Invoices />
                </ProtectedRoute>
              } />
              <Route path="/purchases" element={
                <ProtectedRoute requiredPermission="purchases">
                  <Purchases />
                </ProtectedRoute>
              } />
              <Route path="/products" element={
                <ProtectedRoute requiredPermission="inventory">
                  <Products />
                </ProtectedRoute>
              } />
              <Route path="/clients" element={
                <ProtectedRoute requiredPermission="clients">
                  <Clients />
                </ProtectedRoute>
              } />
              <Route path="/expenses" element={
                <ProtectedRoute requiredPermission="expenses">
                  <Expenses />
                </ProtectedRoute>
              } />
              <Route path="/pos" element={
                <ProtectedRoute requiredPermission="pos">
                  <POS />
                </ProtectedRoute>
              } />
              <Route path="/payment/:id" element={<Payment />} />
              <Route path="/reconciliation" element={
                <ProtectedRoute requiredPermission="reconciliation">
                  <Reconciliation />
                </ProtectedRoute>
              } />
              <Route path="/gst-returns" element={
                <ProtectedRoute requiredPermission="gst_returns">
                  <GSTReturns />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute requiredPermission="reports">
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Settings />
                </ProtectedRoute>
              } />
            </Route>
            
            {/* Public Route */}
            <Route path="/view-invoice/:id" element={<PublicInvoiceView />} />
            <Route path="/invoice/:id" element={<PublicInvoiceView />} />
            <Route path="/public/invoice/:id" element={<PublicInvoiceView />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}
