import { useAuth } from '@/contexts/AuthContext';

export function useRBAC() {
  const { profile } = useAuth();
  
  const isAdmin = profile?.role === 'admin';
  const isBilling = profile?.role === 'billing';
  const isViewOnly = (profile?.role as any) === 'view-only';
  
  const canCreate = isAdmin || isBilling;
  const canEdit = isAdmin || isBilling;
  const canDelete = isAdmin || isBilling; 
  const canManageUsers = isAdmin;

  const hasPermission = (permission: string) => {
    return isAdmin || profile?.permissions?.includes(permission);
  };

  const canGenerateEInvoice = hasPermission('einvoice');

  return { 
    isAdmin, 
    isBilling, 
    isViewOnly,
    canCreate, 
    canEdit, 
    canDelete, 
    canManageUsers,
    canGenerateEInvoice,
    hasPermission,
    role: profile?.role,
    profile
  };
}
