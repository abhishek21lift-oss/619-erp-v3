'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import { api, Client, Attendance } from '@/lib/api';

export default function AttendancePage() {
  return (
    <Guard>
      <AttendanceContent />
    </Guard>
  );
}

function AttendanceContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [bioCode, setBioCode] = useState('');
  const [bioSaving, setBioSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.clients.list({ status: 'active' }),
      api.attendance.list({ date, type: 'client' }),
    ])
      .then(([c, a]) => {
        setClients(c);
        setRecords(a);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  async function mark(client: Client, status: string) {
    setSaving(client.id);
    try {
      await api.attendance.mark({
        type: 'client',
        ref_id: client.id,
        ref_name: client.name,
        trainer_id: client.trainer_id,
        trainer_name: client.trainer_name,
        date,
        status,
      });
      const updated = await api.attendance.list({ date, type: 'client' });
      setRecords(updated);
      setSuccess(`Marked ${client.name} as ${status}`);
      setTimeout(() => setSuccess(''), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  async function biometricCheckIn() {
    if (!bioCode.trim()) return;
    setBioSaving(true);
    setError('');
    try {
      const res = await api.attendance.biometric({ biometric_code: bioCode.trim(), type: 'client' });
      const updated = await api.attendance.list({ date, type: 'client' });
      setRecords(updated);
      setSuccess(res.message);
      setBioCode('');
      setTimeout(() => setSuccess(''), 2200);
    } catch (e: any) {
      setError(e.message || 'Biometric check-in failed');
    } finally {
      setBioSaving(false);
    }
  }

  function getRecord(clientId: string) {
    return records.find((r) => r.ref_id === clientId);
  }

  const STATUS_BTN = [
    { status: 'present', label: 'P', color: 'var(--success)', bg: 'var(--success-bg)' },
    { status: 'absent', label: 'A', color: 'var(--danger)', bg: 'var(--danger-bg)' },
    { status: 'late', label: 'L', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  ];

  const filtered = clients.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.mobile || '').includes(search) ||
      (c.client_id || '').includes(search),
  );

  const summary = {
    present: records.filter((r) => r.status === 'present').length,
    absent: records.filter((r) => r.status === 'absent').length,
    late: records.filter((r) => r.status === 'late').length,
    unmarked: clients.length - records.length,
  };

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form
            className="card mb-3"
            style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
            onSubmit={(e) => { e.preventDefault(); biometricCheckIn(); }}
          >
            <div style={{ fontWeight: 800, color: 'var(--text)' }}>Member Biometric</div>
            <input
              className="input"
              placeholder="Scan fingerprint / enter member code"
              value={bioCode}
              onChange={(e) => setBioCode(e.target.value)}
              style={{ maxWidth: 320 }}
              autoComplete="off"
            />
            <button className="btn btn-primary btn-sm" disabled={bioSaving || !bioCode.trim()}>
              {bioSaving ? 'Checking...' : 'Check In'}
            </button>
            <span className="text-muted text-sm">Device can POST code to /api/attendance/biometric</span>
          </form>

          <div
            className="kpi-grid mb-3"
            style={{ gridTemplateColumns: 'repeat(4,1fr)' }}
          >
            {[
              ['Present', summary.present, 'var(--success)'],
              ['Absent', summary.absent, 'var(--danger)'],
              ['Late', summary.late, 'var(--warning)'],
              ['Unmarked', summary.unmarked, 'var(--muted)'],
            ].map(([lbl, val, color]) => (
              <div
                key={String(lbl)}
                className="card"
                style={{ padding: '0.95rem 1rem', textAlign: 'center' }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: String(color),
                    letterSpacing: '-0.03em',
                  }}
                  className="tabular"
                >
                  {val}
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
                  {lbl}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div
              style={{
                padding: '0.85rem 1.4rem',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <input
                className="input"
                placeholder="Search member"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 280 }}
              />
              <div className="text-muted text-sm">{filtered.length} members</div>
              {date === today && (
                <button
                  className="btn btn-success btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={async () => {
                    for (const c of filtered) {
                      if (!getRecord(c.id)) await mark(c, 'present');
                    }
                  }}
                >
                  ✓ Mark All Present
                </button>
              )}
            </div>

            <div className="table-wrap">
              {loading ? (
                <div
                  style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'var(--muted)',
                  }}
                >
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div
                  style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'var(--muted)',
                  }}
                >
                  No active members found
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Member</th>
                      <th>Coach</th>
                      <th>Plan</th>
                      <th style={{ textAlign: 'center' }}>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const rec = getRecord(c.id);
                      return (
                        <tr key={c.id}>
                          <td>
                            <span className="id-chip">{c.client_id || '—'}</span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td className="text-muted">{c.trainer_name || '—'}</td>
                          <td className="text-muted">{c.package_type || '—'}</td>
                          <td>
                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                justifyContent: 'center',
                              }}
                            >
                              {STATUS_BTN.map(({ status, label, color, bg }) => (
                                <button
                                  key={status}
                                  onClick={() => mark(c, status)}
                                  disabled={saving === c.id}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 7,
                                    border: '1px solid',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    transition: 'all .15s',
                                    background: rec?.status === status ? bg : 'var(--bg-3)',
                                    color: rec?.status === status ? color : 'var(--muted)',
                                    borderColor:
                                      rec?.status === status ? color : 'var(--line-2)',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  {saving === c.id ? '…' : label}
                                </button>
                              ))}
                              {rec && (
                                <span
                                  className="text-muted text-xs tabular"
                                  style={{
                                    alignSelf: 'center',
                                    marginLeft: 4,
                                  }}
                                >
                                  {rec.check_in || ''}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div
            className="text-muted text-xs mt-1"
            style={{
              textAlign: 'center',
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            P · Present  ·  A · Absent  ·  L · Late
          </div>
        </div>
      </div>
    </AppShell>
  );
}
