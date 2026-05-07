'use client';
import { useEffect, useState, useMemo } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Trainer, Attendance } from '@/lib/api';

/**
 * Staff (trainer/coach) attendance — the missing piece that was causing
 * "unable to mark staff attendance". Mirrors the member attendance flow
 * but stores rows under type='trainer' so reports keep working.
 */
export default function StaffAttendancePage() {
  return (
    <Guard>
      <Inner />
    </Guard>
  );
}

function Inner() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [staff, setStaff] = useState<Trainer[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [bioCode, setBioCode] = useState('');
  const [bioSaving, setBioSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([
      api.trainers.list(),
      api.attendance.list({ date, type: 'trainer' }),
    ])
      .then(([t, a]) => {
        if (!alive) return;
        setStaff(t);
        setRecords(Array.isArray(a) ? a : []);
      })
      .catch((e) => alive && setError(e.message || 'Failed to load staff'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [date]);

  async function mark(t: Trainer, status: string) {
    setError('');
    setSaving(t.id);
    try {
      const checkIn = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
      await api.attendance.mark({
        type: 'trainer',
        ref_id: t.id,
        ref_name: t.name,
        trainer_id: t.id,
        trainer_name: t.name,
        date,
        status,
        check_in: status === 'absent' ? null : checkIn,
      });
      const updated = await api.attendance.list({ date, type: 'trainer' });
      setRecords(Array.isArray(updated) ? updated : []);
      setSuccess(`Marked ${t.name} as ${status}`);
      setTimeout(() => setSuccess(''), 1800);
    } catch (e: any) {
      setError(e.message || 'Could not save attendance.');
    } finally {
      setSaving(null);
    }
  }

  function getRecord(staffId: string) {
    return records.find((r) => r.ref_id === staffId);
  }

  const STATUS_BTN = [
    { status: 'present', label: 'P', color: 'var(--success)', bg: 'var(--success-bg)' },
    { status: 'absent', label: 'A', color: 'var(--danger)', bg: 'var(--danger-bg)' },
    { status: 'late', label: 'L', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  ];

  const filtered = useMemo(() => {
    if (!search) return staff;
    const s = search.toLowerCase();
    return staff.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        (t.mobile || '').includes(search) ||
        (t.role || '').toLowerCase().includes(s),
    );
  }, [staff, search]);

  const summary = {
    present: records.filter((r) => r.status === 'present').length,
    absent: records.filter((r) => r.status === 'absent').length,
    late: records.filter((r) => r.status === 'late').length,
    unmarked: staff.length - records.length,
  };

  async function markAllPresent() {
    for (const t of filtered) {
      if (!getRecord(t.id)) await mark(t, 'present');
    }
  }

  async function biometricCheckIn() {
    if (!bioCode.trim()) return;
    setBioSaving(true);
    setError('');
    try {
      const res = await api.attendance.biometric({ biometric_code: bioCode.trim(), type: 'trainer' });
      const updated = await api.attendance.list({ date, type: 'trainer' });
      setRecords(Array.isArray(updated) ? updated : []);
      setSuccess(res.message);
      setBioCode('');
      setTimeout(() => setSuccess(''), 2200);
    } catch (e: any) {
      setError(e.message || 'Biometric check-in failed');
    } finally {
      setBioSaving(false);
    }
  }

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
            <div style={{ fontWeight: 800, color: 'var(--text)' }}>Staff Biometric</div>
            <input
              className="input"
              placeholder="Scan fingerprint / enter staff code"
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
                placeholder="Search staff"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 280 }}
              />
              <div className="text-muted text-sm">{filtered.length} staff</div>
              {date === today && filtered.length > 0 && (
                <button
                  className="btn btn-success btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={markAllPresent}
                >
                  ✓ Mark All Present
                </button>
              )}
            </div>

            <div className="table-wrap">
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No staff found. Add coaches in the Training section first.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Role</th>
                      <th>Mobile</th>
                      <th style={{ textAlign: 'center' }}>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => {
                      const rec = getRecord(t.id);
                      return (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 600 }}>{t.name}</td>
                          <td className="text-muted">{t.role || 'Coach'}</td>
                          <td className="text-muted tabular">{t.mobile || '—'}</td>
                          <td>
                            <div
                              style={{
                                display: 'flex',
                                gap: 6,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              {STATUS_BTN.map(({ status, label, color, bg }) => (
                                <button
                                  key={status}
                                  onClick={() => mark(t, status)}
                                  disabled={saving === t.id}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 7,
                                    border: '1px solid',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    transition: 'all .15s',
                                    background: rec?.status === status ? bg : '#ffffff',
                                    color: rec?.status === status ? color : 'var(--muted)',
                                    borderColor:
                                      rec?.status === status ? color : 'var(--line-2)',
                                    fontFamily: 'inherit',
                                  }}
                                >
                                  {saving === t.id ? '…' : label}
                                </button>
                              ))}
                              {rec && rec.check_in && (
                                <span
                                  className="text-muted text-xs tabular"
                                  style={{ marginLeft: 4 }}
                                >
                                  {rec.check_in}
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
