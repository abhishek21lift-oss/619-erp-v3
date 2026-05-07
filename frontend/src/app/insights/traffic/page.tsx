'use client';
import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

const HOURS = ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];

export default function FootfallTrafficPage() {
  return (
    <Guard>
      <Inner />
    </Guard>
  );
}

function Inner() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  })();

  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.attendance
      .list({ from, to, type: 'client' })
      .then((r: any) => alive && setRecords(Array.isArray(r) ? r : []))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [from, to]);

  const byHour = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      if (!r.check_in) continue;
      const h = String(r.check_in).slice(0, 2);
      map.set(h, (map.get(h) || 0) + 1);
    }
    return HOURS.map((h) => ({ hour: h, count: map.get(h) || 0 }));
  }, [records]);

  const max = Math.max(...byHour.map((h) => h.count), 1);
  const totalCheckins = records.length;
  const peakHour = byHour.reduce((b, h) => (h.count > b.count ? h : b), byHour[0]);

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="kpi-grid mb-3" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            <Stat label="Total Check-ins" value={totalCheckins} color="var(--brand)" />
            <Stat label="Peak Hour" value={peakHour.count > 0 ? `${peakHour.hour}:00` : '—'} color="var(--info)" />
          </div>

          <div className="card">
            <div className="card-title">Check-ins by hour</div>
            {loading ? (
              <div className="text-muted">Loading…</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 220 }}>
                  {byHour.map((h, i) => (
                    <div
                      key={i}
                      title={`${h.hour}:00 — ${h.count} check-ins`}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        height: '100%',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--muted)',
                          marginTop: 'auto',
                          fontWeight: 600,
                        }}
                        className="tabular"
                      >
                        {h.count > 0 ? h.count : ''}
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: `${Math.max((h.count / max) * 100, h.count > 0 ? 4 : 0)}%`,
                          background:
                            h.count > 0
                              ? 'linear-gradient(180deg, var(--brand-hi), var(--brand-lo))'
                              : 'var(--bg-4)',
                          borderRadius: '6px 6px 0 0',
                          minHeight: h.count > 0 ? 6 : 2,
                          transition: 'height .4s',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {byHour.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        fontSize: 10,
                        color: 'var(--muted)',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                      }}
                    >
                      {h.hour}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="kpi-card">
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.03em' }} className="tabular">{value}</div>
      <div className="text-muted" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
