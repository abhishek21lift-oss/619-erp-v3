'use client';

import AppShell from '@/components/AppShell';
import Guard from '@/components/Guard';
import type { Role } from '@/lib/nav-config';

type Props = {
  title: string;
  description: string;
  role?: Role;
};

export default function RoutePlaceholderPage({ title, description, role }: Props) {
  return (
    <Guard role={role}>
      <AppShell>
        <div className="page-main">
          <div className="page-content fade-up">
            <div className="card" style={{ maxWidth: 760, margin: '2rem auto', textAlign: 'center' }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>🛠</div>
              <h1 style={{ margin: 0 }}>{title}</h1>
              <p className="text-muted" style={{ marginTop: 10 }}>
                {description}
              </p>
              <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                This tab is now connected to a valid route. Feature implementation can be added next.
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </Guard>
  );
}
