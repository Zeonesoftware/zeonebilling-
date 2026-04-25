import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Shield, ShieldCheck, Eye, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    }, (error) => {
      console.error("Error fetching users:", error);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === profile?.uid) {
      toast.error('You cannot delete your own admin account');
      return;
    }
    
    if (!confirm('Are you sure you want to remove this user?')) return;
    
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('User removed');
    } catch (err) {
      toast.error('Failed to remove user');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 flex gap-1 items-center px-3 py-1"><ShieldCheck className="w-3 h-3" /> Admin</Badge>;
      case 'billing':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-100 flex gap-1 items-center px-3 py-1"><Shield className="w-3 h-3" /> Billing</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-500 flex gap-1 items-center px-3 py-1"><Eye className="w-3 h-3" /> View Only</Badge>;
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Admin Access Required</h3>
        <p className="text-slate-500 text-sm">Only administrators can manage team members and roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Team Management</h3>
          <p className="text-slate-500 text-xs">Manage your team members and their access levels.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">User</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFD786] flex items-center justify-center font-black text-[#237227] text-sm overflow-hidden">
                       {user.photoURL ? <img src={user.photoURL} alt="" /> : user.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{user.name || 'Unknown User'}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 font-medium"><Mail className="w-2 h-2" /> {user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {getRoleBadge(user.role)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 rounded-full">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl shadow-2xl border-slate-100">
                      <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Change Role</div>
                      <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'admin')} className="gap-3 py-2.5 font-bold text-xs uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> Make Admin
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'billing')} className="gap-3 py-2.5 font-bold text-xs uppercase tracking-wider">
                        <Shield className="w-4 h-4 text-blue-600" /> Make Billing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'view-only')} className="gap-3 py-2.5 font-bold text-xs uppercase tracking-wider">
                        <Eye className="w-4 h-4 text-slate-400" /> Make Viewer
                      </DropdownMenuItem>
                      <div className="my-1 border-t border-slate-100" />
                      <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="gap-3 py-2.5 font-bold text-xs uppercase tracking-wider text-red-600 focus:text-red-600">
                        <Trash2 className="w-4 h-4" /> Remove User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
