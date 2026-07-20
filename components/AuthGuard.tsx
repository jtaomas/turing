import React, { useEffect, useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { loginWithGoogle, getCurrentUser, setAuthToken, getAuthToken, updateProfile, User } from '../services/api';
import Onboarding from './Onboarding';
import { Loader2 } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

interface AuthGuardProps {
  children: React.ReactNode;
  onAuthChange?: (user: User | null) => void;
}

const AuthGuardInner: React.FC<{
  children: React.ReactNode;
  onAuthChange?: (user: User | null) => void;
}> = ({ children, onAuthChange }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      getCurrentUser()
        .then((data) => {
          setUser(data.user);
          onAuthChange?.(data.user);
          if (localStorage.getItem('turing_onboarded') !== 'true') {
            setShowOnboarding(true);
          }
        })
        .catch(() => {
          setAuthToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    try {
      setLoading(true);
      const data = await loginWithGoogle(credentialResponse.credential);
      setUser(data.user);
      onAuthChange?.(data.user);
      if (localStorage.getItem('turing_onboarded') !== 'true') {
        setShowOnboarding(true);
      }
    } catch (err) {
      console.error('Google login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    onAuthChange?.(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="Turing" className="w-14 h-14 object-contain" />
          <Loader2 size={32} className="animate-spin text-emerald-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mono-font">
            Authenticating...
          </p>
        </div>
      </div>
    );
  }

  if (showOnboarding && user) {
    return (
      <Onboarding
        onComplete={async (data) => {
          setShowOnboarding(false);

          try {
            await updateProfile({
              institution: data.institution || user.institution,
              course: data.course,
            } as any);
          } catch { }
          }}
        />
      );
    }

    if (!user) {
      return (
        <div className="min-h-screen bg-[#07080a] flex items-center justify-center">
          <div className="w-full max-w-sm space-y-6 p-8">
            <div className="text-center space-y-2">
              <img src="/logo.png" alt="Turing" className="w-20 h-20 mx-auto mb-3 object-contain" />
              <h1 className="text-2xl font-bold text-white">Turing</h1>
              <p className="text-xs text-neutral-400">Sign in to continue</p>
            </div>
            {GOOGLE_CLIENT_ID ? (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => console.error('Google login failed')}
                  size="large"
                  shape="rectangular"
                  text="signin_with"
                  theme="filled_black"
                />
              </div>
            ) : (
            <div className="space-y-4">
              <p className="text-[11px] text-neutral-500 bg-white/[0.02] border border-white/[0.06] p-4 leading-relaxed">
                To use Google sign-in, add your client ID to{' '}
                <code className="mono-font text-neutral-300">.env.local</code> as{' '}
                <code className="mono-font text-neutral-300">VITE_GOOGLE_CLIENT_ID</code>.
              </p>
              <button
                onClick={() => setUser({
                  id: 1, google_id: 'dev-mode', email: 'dev@turing.math',
                  display_name: 'Student', picture_url: null,
                  institution: 'NSW Board of Studies', course: 'Extension 2 (MX2)',
                  academic_id: 'TURING-DEV001',
                  created_at: new Date().toISOString(), last_login: new Date().toISOString(),
                })}
                className="w-full bg-white/5 hover:bg-white/10 text-neutral-300 py-2.5 text-xs font-semibold transition-all border-0"
              >Continue without signing in</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const AuthGuard: React.FC<AuthGuardProps> = ({ children, onAuthChange }) => {
  if (!GOOGLE_CLIENT_ID) {
    return <AuthGuardInner onAuthChange={onAuthChange}>{children}</AuthGuardInner>;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthGuardInner onAuthChange={onAuthChange}>{children}</AuthGuardInner>
    </GoogleOAuthProvider>
  );
};

export default AuthGuard;
