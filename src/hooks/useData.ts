import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Firestore Error [${operationType}] on ${path}:`, error);
  if (error instanceof Error && error.message.includes('permission-denied')) {
    toast.error(`Permission Denied: You don't have access to ${operationType} this data.`);
  }
}

export function useData<T>(collectionName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;

    setLoading(true);
    const q = query(collection(db, collectionName));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as T));
        setData(items);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, collectionName);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, profile]);

  const addItem = async (item: Partial<T>) => {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...item,
        createdAt: new Date().toISOString(),
        createdBy: profile?.uid
      });
      return { id: docRef.id, ...item };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, collectionName);
      throw err;
    }
  };

  const updateItem = async (id: string, updates: Partial<T>) => {
    try {
      const { id: _, ...cleanUpdates } = updates as any;
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...cleanUpdates,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.uid
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
      throw err;
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
      throw err;
    }
  };

  return { data, loading, error, addItem, updateItem, deleteItem, refresh: () => {} };
}

export function useSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;

    const docRef = doc(db, 'settings', 'config');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        const defaultSettings = {
          companyName: 'Zeone Business',
          gstin: '',
          address: '',
          stateCode: '27',
          phone: '',
          email: '',
          bankName: '',
          accountNumber: '',
          ifscCode: '',
          terms: '1. Please pay within 7 days.\n2. Goods once sold will be charged.',
          currency: 'INR',
          invoicePrefix: 'INV',
          invoiceSeparator: '-',
          invoicePadding: 4,
          lowStockThreshold: 10,
          autoUploadToDrive: false
        };
        setSettings(defaultSettings);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const updateSettings = async (newSettings: any) => {
    try {
      const docRef = doc(db, 'settings', 'config');
      await setDoc(docRef, newSettings);
      toast.success('System settings updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/config');
      throw err;
    }
  };

  return { settings, loading, updateSettings };
}
