import { useAuth } from '@/contexts/AuthContext';

export function useRBAC() {
  const { profile } = useAuth();
  
  const isAdmin = profile?.role === 'admin';
  const isBilling = profile?.role === 'billing';
  const isViewer = profile?.role === 'view-only';
  
  const canCreate = isAdmin || isBilling;
  const canEdit = isAdmin || isBilling;
  const canDelete = isAdmin; 
  const canManageUsers = isAdmin;

  return { 
    isAdmin, 
    isBilling, 
    isViewer, 
    canCreate, 
    canEdit, 
    canDelete, 
    canManageUsers,
    role: profile?.role,
    profile
  };
}
