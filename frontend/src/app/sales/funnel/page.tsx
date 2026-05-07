'use client';
import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Client } from '@/lib/api';

export default function ConversionFunnelPage() {
  return (
    <Guard>
      <Inner />
    </Guard>
  );
}

function Inner() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.clients
      .list({})
      .then((r) => alive && setClients(r))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const stages = useMemo(() => {
    const total = clients.length;
    const leads = clients.filter(
      (c) => c.status === 'lead' || !c.pt_end_date,
    ).length;
    const trials = clients.filter(
      (c) => (c.notes || '').toLowerCase().includes('trial') || c.status === 'trial',
    ).length;
    const converted = clients.filter(
      (c) => c.pt_end_date && Number(c.final_amount || 0) > 0,
    ).length;
    const active = clients.filter((c) => c.status === 'active').length;
    return [
      { key: 'leads', label: 'Leads / Enquiries', value: leads, tone: 'brand' },
      { key: 'trials', label: 'Trial / Tour', value: trials, tone: 'warning' },
      { key: 'converted', label: 'Converted (Paid)', value: converted, tone: 'success' },
      { key: 'active', label: 'Currently Active', value: active, tone: 'success' },
      { key: 'all', label: 'All Records', value: total, tone: 'brand' },
    ];
  }, [clients]);

  const max = Math.max(...stages.map((s) => s.value), 1);
  const lead = stages.find((s) => s.key === 'leads')?.value || 0;
  const conv = stages.find((s) => s.key === 'converted')?.value || 0;
  const convRate = lead + conv > 0 ? Math.round((conv / (lead + conv)) * 100) : 0;

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <div
            className="kpi-grid mb-3"
            style={{ gridTemplateColumns: 'repeat(3,1fr)' }}
          >
            <KpiBox label="Open Leads" value={lead} color="var(--brand)" />
            <KpiBox label="Conversions" value={conv} color="var(--success)" />
            <KpiBox label="Conversion Rate" value={`${convRate}%`} color="var(--info)" />
          </div>

          <div className="card">
            <div className="card-title">Funnel</div>
            {loading ? (
              <div className="text-muted">Loading…</div>
            ) : (
              <div className="funnel">
                {stages.map((s) => (
                  <div key={s.key} className="funnel-row">
                    <div className="funnel-label">{s.label}</div>
                    <div className="funnel-bar-wrap">
                      <div
                        className={`funnel-bar tone-${s.tone}`}
                        style={{ width: `${(s.value / max) * 100}%` }}
                      >
                        <span className="funnel-bar-value">{s.value}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card mt-3">
            <div className="card-title">How to read this</div>
            <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Each stage shows how many records currently sit at that step. A
              healthy gym typically converts 25–40% of in-person enquiries to
              paid members in 30 days. If your conversion rate is low, focus
              on the gap between Trial and Converted — that's almost always
              about follow-up speed and a clear pricing conversation.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function KpiBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="kpi-card">
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color,
          letterSpacing: '-0.03em',
        }}
        className="tabular"
      >
        {value}
      </div>
      <div
        className="text-muted"
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}
