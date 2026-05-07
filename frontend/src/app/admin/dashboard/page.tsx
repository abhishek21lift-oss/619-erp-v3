'use client';
/**
 * Admin Dashboard — redirects to the main /dashboard route which is the
 * unified admin/owner home in the Iron design system.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Guard from '@/components/Guard';

export default function AdminDashboardPage() {
  return (
    <Guard role="admin">
      <Redirect />
    </Guard>
  );
}

function Redirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-1)',
        color: 'var(--muted)',
        fontSize: 13,
      }}
    >
      <div className="pulse">Loading dashboard…</div>
    </div>
  );
}
