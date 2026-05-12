'use client';
/**
 * Login page — premium SaaS design.
 * Centered card with gradient brand accent, email+password form,
 * proper validation, loading state, and error display.
 */
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff, Lock, Mail, Dumbbell } from 'lucide-react';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  // Already logged in → redirect
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'trainer') router.replace('/trainer/dashboard');
      else if (user.role === 'member') router.replace('/member/dashboard');
      else router.replace('/dashboard');
    }
  }, [user, loading, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim())    return setError('Email is required.');
    if (!password)        return setError('Password is required.');
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg-canvas)' }}>
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100dvh',
      background: 'var(--bg-canvas)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Decorative gradient blobs */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            boxShadow: '0 8px 24px rgba(220,38,38,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Dumbbell size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0 }}>
            619 Fitness Studio
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Sign in to your workspace
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ borderRadius: 18, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-2)' }}>
          <div style={{ padding: '28px 28px 24px' }}>
            <form onSubmit={submit} noValidate>
              {/* Error */}
              {error && (
                <div className="alert alert-danger animate-slide-up" style={{ marginBottom: 20 }}>
                  <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Email */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="email">Email address</label>
                <div className="input-wrap">
                  <span className="input-icon"><Mail size={14} /></span>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    placeholder="you@619fitness.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                    disabled={busy}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="password">Password</label>
                </div>
                <div className="input-wrap">
                  <span className="input-icon"><Lock size={14} /></span>
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    className="input"
                    style={{ paddingRight: 40 }}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={busy}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary btn-block btn-md"
                disabled={busy}
                style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.1px' }}
              >
                {busy ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                ) : null}
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
              Having trouble? Contact your gym administrator.
            </p>
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
          © {new Date().getFullYear()} 619 Fitness Studio · All rights reserved
        </p>
      </div>
    </div>
  );
}
