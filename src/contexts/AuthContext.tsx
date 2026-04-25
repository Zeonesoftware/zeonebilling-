import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
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
}

interface AuthContextType {
  user: FIREBASE_USER | null;
  profile: AuthUserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
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
            let role = docSnap.data().role as UserRole;
            // Legacy support: auto-migrate view-only to billing
            if ((docSnap.data().role as string) === 'view-only') {
              role = 'billing';
              import('firebase/firestore').then(({ doc, updateDoc }) => {
                updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'billing' });
              }).catch(console.error);
            }

            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || docSnap.data().name || 'User',
              photoURL: firebaseUser.photoURL || '',
              role: role,
              permissions: docSnap.data().permissions || []
            });
          } else {
            // Check if we already created it in signUpWithEmail or if this is a first-time login
            // We use a small timeout to let signUpWithEmail's setDoc finish if it's currently running
            // or we just try to create it if it really doesn't exist after a moment.
            // Actually, a safer way is to just create it if we are sure we are not already in signUpWithEmail.
            
            // For now, let's just make sure it creates it if missing
            const newProfile: AuthUserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              photoURL: firebaseUser.photoURL || '',
              role: 'billing',
              permissions: []
            };
            
            await setDoc(docRef, {
              email: newProfile.email,
              name: newProfile.displayName,
              role: newProfile.role,
              permissions: newProfile.permissions,
              createdAt: new Date().toISOString()
            }, { merge: true }); // Use merge to avoid overwriting signUpWithEmail's data if it just landed
            
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
      permissions: []
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

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithEmail, signUpWithEmail, logout }}>
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
