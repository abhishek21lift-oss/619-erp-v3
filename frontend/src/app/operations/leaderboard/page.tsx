'use client';
import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

export default function LeaderboardPage() {
  return (
    <Guard>
      <Inner />
    </Guard>
  );
}

function Inner() {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  })();

  const [from, setFrom] = useState(monthAgo);
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
      .catch((e) => alive && setError(e.message || 'Failed to load attendance'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [from, to]);

  const board = useMemo(() => {
    const map = new Map<string, { name: string; checkins: number }>();
    for (const r of records) {
      if (r.status !== 'present' && r.status !== 'late') continue;
      const id = String(r.ref_id || '');
      if (!id) continue;
      const row = map.get(id) || { name: r.ref_name || 'Member', checkins: 0 };
      row.checkins++;
      map.set(id, row);
    }
    return Array.from(map.values()).sort((a, b) => b.checkins - a.checkins);
  }, [records]);

  const top = board[0]?.checkins || 0;

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
              ) : board.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No check-ins recorded in this date range.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>#</th>
                      <th>Member</th>
                      <th>Check-ins</th>
                      <th>Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.map((row, i) => (
                      <tr key={row.name + i}>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: i < 3 ? 'var(--brand-soft)' : 'var(--bg-4)',
                              color: i < 3 ? 'var(--brand)' : 'var(--muted)',
                              fontWeight: 800,
                              fontSize: 13,
                            }}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{row.name}</td>
                        <td className="tabular" style={{ fontWeight: 700 }}>
                          {row.checkins}
                        </td>
                        <td style={{ width: '40%' }}>
                          <div className="progress">
                            <div
                              className="progress-fill red"
                              style={{ width: `${(row.checkins / top) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
