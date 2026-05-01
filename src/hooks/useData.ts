import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export { OperationType };

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
        try {
          handleFirestoreError(err, OperationType.LIST, collectionName);
        } catch (wrappedError: any) {
          setError(wrappedError.message);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, profile]);

  const addItem = async (item: Partial<T>) => {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...item,
        createdAt: serverTimestamp(),
        createdBy: profile ? {
          uid: profile.uid,
          name: profile.displayName || 'User'
        } : null
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
        updatedAt: serverTimestamp(),
        updatedBy: profile?.uid || null
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

const DEFAULT_SETTINGS = {
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
  useFiscalYear: true,
  fiscalYearFormat: 'YYYY',
  lowStockThreshold: 10,
  autoUploadToDrive: false
};

export function useSettings() {
  const [settings, setSettings] = useState<any>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;

    const docRef = doc(db, 'settings', 'config');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
      setLoading(false);
    }, (err) => {
      console.error("Settings fetch error:", err);
      try {
        handleFirestoreError(err, OperationType.GET, 'settings/config');
      } catch (wrappedError: any) {
        // We don't necessarily want to toast here as it might be default behavior
        setError(wrappedError.message);
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

  return { settings, loading, error, updateSettings };
}
