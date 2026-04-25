import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogIn, ReceiptIndianRupee, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { signIn, signInWithEmail, signUpWithEmail, loading } = useAuth();
  const [isEmailView, setIsEmailView] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !name)) {
      toast.error('Please fill in all fields');
      return;
    }

    setAuthLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name);
        toast.success('Account created successfully');
      } else {
        await signInWithEmail(email, password);
        toast.success('Signed in successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
      >
        <div className="bg-[#237227] p-10 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <ReceiptIndianRupee className="w-64 h-64 -rotate-12 absolute -top-10 -left-10" />
            <ReceiptIndianRupee className="w-48 h-48 rotate-12 absolute -bottom-10 -right-10" />
          </div>
          
          <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl border border-white/30 relative z-10">
            <ReceiptIndianRupee className="w-8 h-8 text-white" />
          </div>
          
          <h1 className="text-2xl font-black tracking-tight mb-1 relative z-10">Zeone Billing</h1>
          <p className="text-white/70 font-medium text-sm relative z-10">Professional GST Invoicing System</p>
        </div>
        
        <div className="p-8 md:p-10">
          <AnimatePresence mode="wait">
            {!isEmailView ? (
              <motion.div
                key="choice"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="text-center"
              >
                <h2 className="text-xl font-bold text-slate-800 mb-2">Welcome Back</h2>
                <p className="text-slate-500 text-sm mb-8">Choose your preferred sign-in method to access the portal.</p>
                
                <div className="space-y-4">
                  <Button 
                    onClick={signIn} 
                    disabled={loading || authLoading}
                    className="w-full py-7 rounded-2xl bg-white text-slate-700 border-2 border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all gap-4 text-base font-bold shadow-sm"
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                    Continue with Google
                  </Button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-slate-300 bg-white px-4">
                      Or
                    </div>
                  </div>

                  <Button 
                    onClick={() => setIsEmailView(true)}
                    variant="ghost"
                    className="w-full py-7 rounded-2xl border-2 border-dashed border-slate-100 text-slate-500 hover:text-slate-700 hover:border-slate-200 hover:bg-slate-50 font-bold gap-3"
                  >
                    <Mail className="w-5 h-5" />
                    Continue with Email
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="email-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button 
                  onClick={() => setIsEmailView(false)}
                  className="mb-6 text-xs font-bold text-[#237227] hover:underline flex items-center gap-1"
                >
                  ← Back to options
                </button>

                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  {isSignUp ? 'Create Account' : 'Email Login'}
                </h2>
                <p className="text-slate-500 text-sm mb-6">
                  {isSignUp ? 'Enter your details to register.' : 'Access your account with your credentials.'}
                </p>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                          placeholder="Your Name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="pl-11 h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-11 h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-11 h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={authLoading}
                    className="w-full h-12 rounded-xl bg-[#237227] hover:bg-[#1b5a1e] text-white font-bold gap-2 shadow-lg shadow-[#237227]/20"
                  >
                    {authLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {isSignUp ? 'Create Profile' : 'Sign In'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-slate-500 mt-4">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button 
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-[#237227] font-bold hover:underline"
                    >
                      {isSignUp ? 'Login here' : 'Sign up now'}
                    </button>
                  </p>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="mt-8 pt-6 border-t border-slate-50 overflow-hidden">
            <div className="flex justify-center gap-4 whitespace-nowrap">
              <div className="text-[8px] uppercase tracking-widest font-black text-slate-300">GST Ready</div>
              <div className="text-[8px] uppercase tracking-widest font-black text-slate-300">•</div>
              <div className="text-[8px] uppercase tracking-widest font-black text-slate-300">Cloud Sync</div>
              <div className="text-[8px] uppercase tracking-widest font-black text-slate-300">•</div>
              <div className="text-[8px] uppercase tracking-widest font-black text-slate-300">Fast & Secure</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
