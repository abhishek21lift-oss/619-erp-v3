'use client';

import AppShell from '@/components/AppShell';
import Guard from '@/components/Guard';
import type { Role } from '@/lib/nav-config';

type Props = {
  title: string;
  description: string;
  role?: Role;
};

const actions = ['Review this week', 'Export view', 'Add note'];

export default function RoutePlaceholderPage({ title, description, role }: Props) {
  return (
    <Guard role={role}>
      <AppShell>
        <div className="page-main">
          <div className="page-content fade-up">
            <div style={{ display: 'grid', gap: '1rem' }}>
              <section className="card">
                <div className="section-header">
                  <div>
                    <p className="eyebrow">Workspace</p>
                    <h1 style={{ margin: 0 }}>{title}</h1>
                    <p className="text-muted" style={{ margin: '0.5rem 0 0' }}>
                      {description}
                    </p>
                  </div>
                </div>
              </section>

              <section className="kpi-grid">
                <div className="kpi-card blue">
                  <span className="kpi-label">Open Items</span>
                  <strong className="kpi-value">0</strong>
                  <span className="kpi-meta">No pending work</span>
                </div>
                <div className="kpi-card green">
                  <span className="kpi-label">This Week</span>
                  <strong className="kpi-value">Ready</strong>
                  <span className="kpi-meta">Route and access checks active</span>
                </div>
                <div className="kpi-card yellow">
                  <span className="kpi-label">Data State</span>
                  <strong className="kpi-value">Synced</strong>
                  <span className="kpi-meta">Uses shared app shell</span>
                </div>
              </section>

              <section className="card">
                <div className="section-header">
                  <div>
                    <h2 style={{ margin: 0 }}>Actions</h2>
                    <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
                      Common workflows for this module are available here.
                    </p>
                  </div>
                </div>
                <div className="grid auto-grid">
                  {actions.map((action) => (
                    <button key={action} type="button" className="btn btn-outline">
                      {action}
                    </button>
                  ))}
                </div>
              </section>

              <section className="card">
                <div className="empty-state">
                  <h2>No records yet</h2>
                  <p className="text-muted">
                    When records are added for this area, they will appear here with filtering,
                    export, and audit-friendly status details.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </AppShell>
    </Guard>
  );
}
