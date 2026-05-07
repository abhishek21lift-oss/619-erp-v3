'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Client } from '@/lib/api';
import { fmtDate } from '@/lib/format';

export default function TransformationsPage() {
  return <Guard><Inner /></Guard>;
}

function Inner() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    let alive = true;
    api.clients.list({ status: 'active' })
      .then((r) => alive && setClients(r))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const s = search.toLowerCase();
    return clients.filter(
      (c) => c.name?.toLowerCase().includes(s) ||
        (c.client_id || '').toLowerCase().includes(s) ||
        (c.trainer_name || '').toLowerCase().includes(s),
    );
  }, [clients, search]);

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
            <h2 style={{ fontWeight:700, fontSize:20, margin:0 }}>Transformations</h2>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span className="text-muted text-sm">{filtered.length} {filtered.length === 1 ? 'member' : 'members'}</span>
              <input className="input" placeholder="Search member or coach…" value={search}
                onChange={(e) => setSearch(e.target.value)} style={{ maxWidth:220 }} />
            </div>
          </div>

          <div className="card" style={{ padding:0 }}>
            <div className="table-wrap">
              {loading ? (
                <div style={{ padding:'3rem', textAlign:'center', color:'var(--muted)' }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding:'3rem', textAlign:'center', color:'var(--muted)' }}>No active members yet.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ID</th><th>Member</th><th>Coach</th><th>Start Weight</th><th>Joined</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr key={c.id}>
                        <td><span className="id-chip">{c.client_id || '—'}</span></td>
                        <td style={{ fontWeight:600 }}>{c.name}</td>
                        <td className="text-muted">{c.trainer_name || '—'}</td>
                        <td className="text-muted tabular">{c.weight ? `${c.weight} kg` : '—'}</td>
                        <td className="text-muted tabular">{fmtDate(c.joining_date || c.pt_start_date)}</td>
                        <td><Link href={`/clients/${c.id}`} className="btn btn-ghost btn-sm">Log progress →</Link></td>
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
