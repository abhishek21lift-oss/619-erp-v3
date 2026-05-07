'use client';
import { useEffect, useState, useRef, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import BrandLogo from '@/components/BrandLogo';

/* =====================================================================
   WebAuthn / Biometric helpers
   ===================================================================== */
const CRED_STORE_KEY = '619_biometric_creds';

function isBiometricSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof navigator?.credentials?.create === 'function' &&
    typeof navigator?.credentials?.get === 'function'
  );
}

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromBase64url(str: string): ArrayBuffer {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

function getStoredCreds(): { id: string; rawId: string }[] {
  try {
    const raw = localStorage.getItem(CRED_STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function storeCred(id: string, rawId: string) {
  const existing = getStoredCreds().filter((c) => c.id !== id);
  localStorage.setItem(CRED_STORE_KEY, JSON.stringify([...existing, { id, rawId }]));
}

async function registerBiometric(userId: string, userName: string): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId);
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: '619 FITNESS STUDIO', id: window.location.hostname },
        user: { id: userIdBytes, name: userName, displayName: userName },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    storeCred(cred.id, base64url(cred.rawId));
    return true;
  } catch { return false; }
}

async function authenticateWithBiometric(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  const stored = getStoredCreds();
  if (stored.length === 0) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: stored.map((c) => ({
          type: 'public-key' as const,
          id: fromBase64url(c.rawId),
          transports: ['internal' as AuthenticatorTransport],
        })),
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    return !!assertion;
  } catch { return false; }
}

/* =====================================================================
   Animated particle canvas background
   ===================================================================== */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    const COUNT = Math.min(Math.floor((window.innerWidth * window.innerHeight) / 12000), 55);
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.2 + 0.4,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.45 + 0.08,
      color: Math.random() > 0.55 ? '#e11d48' : Math.random() > 0.5 ? '#7c3aed' : '#f59e0b',
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = 'rgba(225,29,72,0.07)';
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = ((110 - dist) / 110) * 0.18;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}

/* =====================================================================
   Fingerprint SVG icon
   ===================================================================== */
function FingerprintIcon({ scanning }: { scanning: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: 52,
        height: 52,
        filter: scanning ? 'drop-shadow(0 0 10px rgba(225,29,72,0.7))' : 'none',
        transition: 'filter 0.3s ease',
      }}
    >
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.15" />
      <path
        d="M32 10 C20 10 12 20 12 32"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeOpacity={scanning ? '1' : '0.5'}
        className={scanning ? 'fp-scan-1' : ''}
      />
      <path
        d="M32 10 C44 10 52 20 52 32"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeOpacity={scanning ? '1' : '0.5'}
        className={scanning ? 'fp-scan-2' : ''}
      />
      <path
        d="M16 38 C16 46 23 52 32 52 C41 52 48 46 48 38"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeOpacity={scanning ? '1' : '0.5'}
        className={scanning ? 'fp-scan-3' : ''}
      />
      <path
        d="M20 28 C20 22 25.5 18 32 18 C38.5 18 44 22 44 28 C44 34 44 38 32 38 C24 38 20 34 20 28Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"
        strokeOpacity={scanning ? '0.9' : '0.4'}
      />
      <path
        d="M26 28 C26 25 28.5 23 32 23 C35.5 23 38 25 38 28 C38 32 36 36 32 36"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"
        strokeOpacity={scanning ? '0.9' : '0.4'}
      />
      <path
        d="M29.5 32 C29.5 30.5 30.6 29.5 32 29.5 C33.4 29.5 34.5 30.5 34.5 32"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"
        strokeOpacity={scanning ? '0.9' : '0.4'}
      />
      {scanning && (
        <line
          x1="12" y1="32" x2="52" y2="32"
          stroke="currentColor" strokeWidth="2" strokeOpacity="0.8"
          className="fp-scanline"
        />
      )}
    </svg>
  );
}

/* =====================================================================
   Biometric panel (extracted sub-component)
   ===================================================================== */
type BioStatus = 'idle' | 'scanning' | 'success' | 'error';

interface BioUser { email: string; name: string }

interface BioPanelProps {
  bioUser: BioUser | null;
  bioStatus: BioStatus;
  bioScanning: boolean;
  onAuthenticate: () => void;
  onSwitchToPassword: () => void;
  onRemoveBiometric: () => void;
}

function BiometricPanel({
  bioUser, bioStatus, bioScanning,
  onAuthenticate, onSwitchToPassword, onRemoveBiometric,
}: BioPanelProps) {
  const iconClass = [
    'bio-icon-wrap',
    bioStatus === 'scanning' ? 'bio-icon-scanning'
      : bioStatus === 'success' ? 'bio-icon-success'
      : bioStatus === 'error' ? 'bio-icon-error'
      : 'bio-icon-idle',
  ].join(' ');

  const isClickable = bioStatus === 'idle' || bioStatus === 'error';

  function getLabel() {
    if (bioStatus === 'scanning') return 'Verifying biometrics...';
    if (bioStatus === 'success') return 'Identity confirmed!';
    if (bioStatus === 'error') return 'Verification failed';
    if (bioUser?.name) return 'Welcome back, ' + bioUser.name.split(' ')[0];
    return 'Touch to authenticate';
  }

  return (
    <div className="login-v2-bio-panel">
      <div
        className={iconClass}
        onClick={isClickable ? onAuthenticate : undefined}
        style={{ cursor: isClickable ? 'pointer' : 'default' }}
        title="Tap to authenticate"
      >
        {bioStatus === 'success' && <span style={{ fontSize: 42 }}>&#10003;</span>}
        {bioStatus === 'error' && <span style={{ fontSize: 42 }}>&#10007;</span>}
        {bioStatus !== 'success' && bioStatus !== 'error' && (
          <FingerprintIcon scanning={bioStatus === 'scanning'} />
        )}
      </div>

      <p className="login-v2-bio-label">{getLabel()}</p>

      {bioStatus === 'idle' && (
        <button
          className="login-v2-bio-tap-btn"
          onClick={onAuthenticate}
          disabled={bioScanning}
        >
          <span style={{ fontSize: 20 }}>&#128070;</span>
          Tap fingerprint to sign in
        </button>
      )}

      <div className="login-v2-bio-divider">
        <span>or</span>
      </div>

      <button
        className="btn btn-ghost"
        style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
        onClick={onSwitchToPassword}
      >
        Use password instead
      </button>

      <button
        onClick={onRemoveBiometric}
        className="login-v2-remove-bio-btn"
      >
        Remove saved biometrics
      </button>
    </div>
  );
}

/* =====================================================================
   Password form (extracted sub-component)
   ===================================================================== */
interface PasswordFormProps {
  email: string;
  password: string;
  loading: boolean;
  showPass: boolean;
  bioSupported: boolean;
  bioRegistered: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onTogglePass: () => void;
  onSubmit: (e: FormEvent) => void;
  onSwitchToBio: () => void;
}

function PasswordForm({
  email, password, loading, showPass,
  bioSupported, bioRegistered,
  onEmailChange, onPasswordChange, onTogglePass,
  onSubmit, onSwitchToBio,
}: PasswordFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
      noValidate
    >
      <div className="login-v2-field">
        <label className="login-v2-label">
          <span className="login-v2-label-icon">&#9993;</span>
          Email address
        </label>
        <div className="login-v2-input-wrap">
          <input
            className="input login-v2-input"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@619fitness.com"
            required
            autoFocus
            autoComplete="email"
          />
        </div>
      </div>

      <div className="login-v2-field">
        <label className="login-v2-label">
          <span className="login-v2-label-icon">&#128274;</span>
          Password
        </label>
        <div className="login-v2-input-wrap" style={{ position: 'relative' }}>
          <input
            className="input login-v2-input"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
            required
            autoComplete="current-password"
            style={{ paddingRight: '3.2rem' }}
          />
          <button
            type="button"
            onClick={onTogglePass}
            aria-label={showPass ? 'Hide password' : 'Show password'}
            className="login-v2-show-btn"
          >
            {showPass ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg login-v2-submit"
        disabled={loading}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <span className="login-v2-spinner" />
            Signing in...
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            Sign In
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="16" height="16">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        )}
      </button>

      {bioSupported && bioRegistered && (
        <button
          type="button"
          className="login-v2-bio-shortcut"
          onClick={onSwitchToBio}
        >
          <span className="login-v2-bio-shortcut-icon">
            <FingerprintIcon scanning={false} />
          </span>
          <span>Use fingerprint / biometric login</span>
        </button>
      )}
    </form>
  );
}

/* =====================================================================
   Main LoginPage component
   ===================================================================== */
export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [bioSupported, setBioSupported] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(false);
  const [bioScanning, setBioScanning] = useState(false);
  const [bioStatus, setBioStatus] = useState<BioStatus>('idle');
  const [showRegisterBio, setShowRegisterBio] = useState(false);
  const [bioMode, setBioMode] = useState(false);
  const [bioUser, setBioUser] = useState<BioUser | null>(null);

  useEffect(() => {
    setMounted(true);
    // SECURITY MIGRATION: prior versions stored the user's password
    // (base64-encoded) in localStorage to enable biometric "auto-login".
    // That's a credential-theft vector. Sweep it on first paint of the
    // login page so any existing user upgrading their JS bundle has the
    // legacy entry removed before we ever touch it.
    try { localStorage.removeItem('619_bio_pass'); } catch { /* ignore */ }

    const supported = isBiometricSupported();
    setBioSupported(supported);
    const creds = getStoredCreds();
    const hasReg = creds.length > 0;
    setBioRegistered(hasReg);
    if (hasReg) {
      try {
        const stored = localStorage.getItem('619_bio_user');
        if (stored) setBioUser(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  const handleBiometricLogin = useCallback(async () => {
    if (!bioRegistered || !bioUser) return;
    setBioScanning(true);
    setBioStatus('scanning');
    setError('');
    try {
      const ok = await authenticateWithBiometric();
      if (!ok) {
        setBioStatus('error');
        setError('Biometric verification failed. Try again or use your password.');
        setTimeout(() => setBioStatus('idle'), 2000);
        return;
      }

      // ── SECURITY: never replay a stored password from localStorage ──
      // Biometric only "unlocks" an existing valid JWT session. If the
      // session has been wiped or expired, fall back to password auth.
      // A future hardening step is to make biometric exchange a
      // server-issued challenge for a short-lived refresh token.
      const existingToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('619_token')
          : null;
      if (!existingToken) {
        setBioStatus('error');
        setError(
          'Your session has expired. Please sign in once with your password — biometric will work again after that.',
        );
        setBioMode(false);
        setTimeout(() => setBioStatus('idle'), 2500);
        return;
      }

      setBioStatus('success');
      router.replace('/dashboard');
    } catch {
      setBioStatus('error');
      setError('Biometric authentication error.');
      setTimeout(() => setBioStatus('idle'), 2000);
    } finally {
      setBioScanning(false);
    }
  }, [bioRegistered, bioUser, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      if (bioSupported && !bioRegistered) {
        setShowRegisterBio(true);
      } else {
        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const lower = msg.toLowerCase();
      if (lower.includes('database') || lower.includes('connection')) {
        setError('Cannot reach the database. Please try again in a moment.');
      } else if (lower.includes('configuration') || lower.includes('jwt')) {
        setError('Server configuration error. Contact the administrator.');
      } else if (lower.includes('fetch') || lower.includes('network') || lower.includes('failed to fetch')) {
        setError('Cannot reach the server. Check your connection.');
      } else if (lower.includes('too many')) {
        setError('Too many attempts. Please wait 15 minutes and try again.');
      } else {
        setError(msg || 'Login failed. Check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterBiometric() {
    if (!user) return;
    const ok = await registerBiometric(
      user.id?.toString() || user.email,
      user.name || user.email,
    );
    if (ok) {
      // SECURITY: store ONLY the public-key handle + the user's email/name.
      // We never persist the password — biometric login simply unlocks a
      // session that already exists locally (the JWT in localStorage).
      localStorage.setItem(
        '619_bio_user',
        JSON.stringify({ email: email.trim(), name: user.name || '' }),
      );
      // Belt-and-braces: clear any legacy plaintext-password cache that an
      // older version of this page may have written.
      localStorage.removeItem('619_bio_pass');
      setBioRegistered(true);
      setBioUser({ email: email.trim(), name: user.name || email.trim() });
    }
    setShowRegisterBio(false);
    router.replace('/dashboard');
  }

  function removeBiometric() {
    localStorage.removeItem(CRED_STORE_KEY);
    localStorage.removeItem('619_bio_user');
    localStorage.removeItem('619_bio_pass'); // legacy, in case it was stored
    setBioRegistered(false);
    setBioUser(null);
    setBioMode(false);
  }

  if (!mounted || user) return null;

  /* ── Biometric registration prompt ── */
  if (showRegisterBio) {
    return (
      <div className="login-shell login-v2-shell">
        <ParticleField />
        <div className="login-v2-orb login-v2-orb-1" />
        <div className="login-v2-orb login-v2-orb-2" />
        <div className="login-v2-register-wrap fade-up">
          <div className="login-v2-card">
            <div className="login-v2-card-accent" />
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div className="bio-icon-wrap bio-icon-pulse" style={{ margin: '0 auto 1rem', color: 'var(--brand)' }}>
                <FingerprintIcon scanning={false} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
                Enable Fingerprint Login?
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                Use your device fingerprint or face recognition to sign in faster next time.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary btn-lg login-v2-submit"
                style={{ justifyContent: 'center', gap: 8 }}
                onClick={handleRegisterBiometric}
              >
                <span>&#128282;</span>
                Enable Biometric Login
              </button>
              <button
                className="btn btn-ghost"
                style={{ justifyContent: 'center', borderRadius: '10px', minHeight: '42px' }}
                onClick={() => { setShowRegisterBio(false); router.replace('/dashboard'); }}
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main login UI ── */
  return (
    <div className="login-shell login-v2-shell">
      <ParticleField />

      <div className="login-v2-orb login-v2-orb-1" />
      <div className="login-v2-orb login-v2-orb-2" />
      <div className="login-v2-orb login-v2-orb-3" />

      <div className="login-v2-layout">

        {/* Left hero panel */}
        <div className="login-v2-hero">
          <div className="login-v2-hero-inner">
            <div className="login-v2-hero-badge">PREMIUM STRENGTH STUDIO</div>

            <div className="login-v2-logo-wrap">
              <div className="login-v2-logo-ring" />
              <BrandLogo size={90} />
            </div>

            <h1 className="login-v2-hero-title">
              619<br />FITNESS<br />STUDIO
            </h1>

            <p className="login-v2-hero-sub">
              Train heavy.<br />Run light.<br />Live strong.
            </p>

            <div className="login-v2-hero-stats">
              <div className="login-v2-stat">
                <span className="login-v2-stat-num">500+</span>
                <span className="login-v2-stat-label">Members</span>
              </div>
              <div className="login-v2-stat-div" />
              <div className="login-v2-stat">
                <span className="login-v2-stat-num">15+</span>
                <span className="login-v2-stat-label">Programs</span>
              </div>
              <div className="login-v2-stat-div" />
              <div className="login-v2-stat">
                <span className="login-v2-stat-num">24/7</span>
                <span className="login-v2-stat-label">Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right form column */}
        <div className="login-v2-form-col">
          <div className="login-v2-card fade-up">
            <div className="login-v2-card-accent" />

            {/* Mobile-only brand */}
            <div className="login-v2-mobile-brand">
              <BrandLogo size={52} />
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text)' }}>
                  619 FITNESS STUDIO
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700 }}>
                  Premium Strength Studio
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h2 className="login-v2-heading">Welcome back</h2>
              <p className="login-v2-sub">Sign in to your workspace</p>
            </div>

            {error && (
              <div className="login-v2-error fade-up">
                <span className="login-v2-error-icon">&#9888;</span>
                <span>{error}</span>
              </div>
            )}

            {bioMode && bioRegistered ? (
              <BiometricPanel
                bioUser={bioUser}
                bioStatus={bioStatus}
                bioScanning={bioScanning}
                onAuthenticate={handleBiometricLogin}
                onSwitchToPassword={() => { setBioMode(false); setError(''); setBioStatus('idle'); }}
                onRemoveBiometric={removeBiometric}
              />
            ) : (
              <PasswordForm
                email={email}
                password={password}
                loading={loading}
                showPass={showPass}
                bioSupported={bioSupported}
                bioRegistered={bioRegistered}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onTogglePass={() => setShowPass((p) => !p)}
                onSubmit={handleSubmit}
                onSwitchToBio={() => { setBioMode(true); setError(''); }}
              />
            )}

            <div className="login-v2-footer">
              <div className="login-v2-footer-line" />
              <span>&#169; {new Date().getFullYear()} 619 FITNESS STUDIO</span>
              <div className="login-v2-footer-line" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
