import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type UserRole = 'admin' | 'billing';

interface AuthUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  permissions?: string[];
  phoneNumber?: string;
}

interface AuthContextType {
  user: FIREBASE_USER | null;
  profile: AuthUserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInWithPhone: (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FIREBASE_USER | null>(null);
  const [profile, setProfile] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.role === 'removed') {
              await signOut(auth);
              setProfile(null);
              setLoading(false);
              return;
            }

            let role = data.role as UserRole;
            // Legacy support: auto-migrate view-only to billing
            if ((docSnap.data().role as string) === 'view-only') {
              role = 'billing';
              import('firebase/firestore').then(({ doc, updateDoc }) => {
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'billing' });
              }).catch(console.error);
            }

            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || docSnap.data().email || '',
              displayName: firebaseUser.displayName || docSnap.data().name || 'User',
              photoURL: firebaseUser.photoURL || '',
              role: role,
              permissions: docSnap.data().permissions || [],
              phoneNumber: firebaseUser.phoneNumber || ''
            });
          } else {
            // Check if we already created it in signUpWithEmail or if this is a first-time login
            const isOwner = firebaseUser.email === 'zeonesoftware@gmail.com';
            const newProfile: AuthUserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              photoURL: firebaseUser.photoURL || '',
              role: isOwner ? 'admin' : 'billing',
              permissions: isOwner 
                ? ['pos', 'invoices', 'inventory', 'purchases', 'clients', 'expenses', 'reconciliation', 'reports', 'quick_actions', 'gst_returns'] 
                : ['invoices', 'purchases', 'inventory', 'clients', 'expenses', 'quick_actions', 'pos'],
              phoneNumber: firebaseUser.phoneNumber || ''
            };
            
            await setDoc(docRef, {
              email: newProfile.email,
              name: newProfile.displayName,
              role: newProfile.role,
              permissions: newProfile.permissions,
              phoneNumber: newProfile.phoneNumber,
              createdAt: new Date().toISOString()
            }, { merge: true });
            
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching/creating profile:", error);
          setLoading(false);
          return;
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    
    // Create profile immediately for email signup
    const newProfile: AuthUserProfile = {
      uid: cred.user.uid,
      email: cred.user.email || '',
      displayName: name,
      photoURL: '',
      role: 'billing',
      permissions: ['invoices', 'purchases', 'inventory', 'clients', 'expenses', 'quick_actions', 'pos']
    };
    
    await setDoc(doc(db, 'users', cred.user.uid), {
      email: newProfile.email,
      name: newProfile.displayName,
      role: newProfile.role,
      permissions: newProfile.permissions,
      createdAt: new Date().toISOString()
    });
    
    setProfile(newProfile);
  };

  const signInWithPhone = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => {
    return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithEmail, signUpWithEmail, signInWithPhone, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Internal type alias to avoid conflict with imported User
type FIREBASE_USER = FirebaseUser;
