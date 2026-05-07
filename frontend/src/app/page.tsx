'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import BrandLogo from '@/components/BrandLogo';

export default function Root() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(user ? '/dashboard' : '/login');
  }, [user, loading, router]);

  return (
    <div className="login-shell" aria-busy="true" role="status">
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }} className="fade-up">
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.5rem' }}>
          <div
            style={{
              position: 'absolute',
              inset: -16,
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--brand-glow) 0%, transparent 70%)',
              filter: 'blur(10px)',
              animation: 'pulse-glow 1.8s ease-in-out infinite',
            }}
          />
          <BrandLogo size={84} />
        </div>
        <div
          className="display"
          style={{ fontSize: 22, marginBottom: 8 }}
        >
          619 Fitness
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '2.4px',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          Loading aurora …
        </div>
      </div>
    </div>
  );
}
