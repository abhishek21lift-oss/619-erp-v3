'use client';
import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

export default function TrainersPage() {
  return (
    <Guard role="admin">
      <TrainersContent />
    </Guard>
  );
}

const EMPTY = {
  name: '',
  mobile: '',
  email: '',
  role: 'Personal Trainer',
  joining_date: '',
  salary: '',
  incentive_rate: '50',
  specialization: '',
  certifications: '',
  status: 'active',
  notes: '',
};

function TrainersContent() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState<any | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const load = () => {
    setLoading(true);
    api.trainers
      .list()
      .then(setTrainers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  function flash(msg: string, isError = false) {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 3000);
  }

  function openNew() {
    setForm(EMPTY);
    setModal('new');
  }
  function openEdit(t: any) {
    setForm({
      ...EMPTY,
      ...t,
      incentive_rate: String(Math.round((t.incentive_rate || 0.5) * 100)),
      salary: String(t.salary ?? 0),
      joining_date: t.joining_date ? String(t.joining_date).split('T')[0] : '',
    });
    setModal(t);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) return flash('Name is required', true);
    setSaving(true);
    try {
      const payload = {
        ...form,
        salary: parseFloat(form.salary) || 0,
        incentive_rate: parseFloat(form.incentive_rate) || 50,
      };
      if (modal === 'new') {
        await api.trainers.create(payload);
        flash('Coach added');
      } else if (modal) {
        await api.trainers.update(modal.id, payload);
        flash('Coach updated');
      }
      setModal(null);
      load();
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete coach "${name}"?`)) return;
    setDeleting(id);
    try {
      await api.trainers.delete(id);
      flash(`${name} deleted`);
      load();
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setDeleting(null);
    }
  }

  const S =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f: any) => ({ ...f, [k]: e.target.value }));

  const fmt = (n: any) =>
    '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {loading ? (
            <div className="card">
              <div className="text-muted">Loading coaches…</div>
            </div>
          ) : trainers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>⚒</div>
              <div className="text-muted mb-2">No coaches added yet</div>
              <button className="btn btn-primary" onClick={openNew}>
                + Add First Coach
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: '0.85rem',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              }}
            >
              {trainers.map((t) => (
                <div
                  key={t.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '.85rem',
                    opacity: deleting === t.id ? 0.4 : 1,
                    cursor: 'default',
                  }}
                >
                  <Link
                    href={`/trainers/${t.id}`}
                    style={{
                      display: 'block',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '.85rem',
                      }}
                    >
                      <div
                        className="user-avatar"
                        style={{ width: 44, height: 44, fontSize: 14, borderRadius: 10 }}
                      >
                        {t.name
                          .split(' ')
                          .map((w: string) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            letterSpacing: '-0.012em',
                          }}
                          className="truncate"
                        >
                          {t.name}
                        </div>
                        <div className="text-muted text-xs truncate">
                          {t.role || 'Personal Trainer'}
                        </div>
                      </div>
                      <span
                        className={`badge badge-${
                          t.status === 'active' ? 'active' : 'expired'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '.5rem',
                        marginTop: '.85rem',
                      }}
                    >
                      <div>
                        <div
                          className="text-muted"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '1.2px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Active
                        </div>
                        <div
                          style={{
                            fontWeight: 700,
                            color: 'var(--success)',
                            fontSize: 14,
                            marginTop: 2,
                          }}
                          className="tabular"
                        >
                          {t.active_clients ?? 0}
                        </div>
                      </div>
                      <div>
                        <div
                          className="text-muted"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '1.2px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Month Rev
                        </div>
                        <div
                          style={{
                            fontWeight: 700,
                            color: 'var(--brand-hi)',
                            fontSize: 14,
                            marginTop: 2,
                          }}
                          className="tabular"
                        >
                          {fmt(t.month_revenue)}
                        </div>
                      </div>
                      <div>
                        <div
                          className="text-muted"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '1.2px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Salary
                        </div>
                        <div
                          style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}
                          className="tabular"
                        >
                          {fmt(t.salary)}
                        </div>
                      </div>
                      <div>
                        <div
                          className="text-muted"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '1.2px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Incentive
                        </div>
                        <div
                          style={{ fontWeight: 600, fontSize: 13.5, marginTop: 2 }}
                          className="tabular"
                        >
                          {Math.round((t.incentive_rate || 0.5) * 100)}%
                        </div>
                      </div>
                    </div>

                    {t.specialization && (
                      <div
                        className="text-muted text-xs"
                        style={{ marginTop: '.6rem' }}
                      >
                        ◧ {t.specialization}
                      </div>
                    )}
                  </Link>

                  <div
                    style={{
                      display: 'flex',
                      gap: '.5rem',
                      borderTop: '1px solid var(--line)',
                      paddingTop: '.85rem',
                    }}
                  >
                    <Link
                      href={`/trainers/${t.id}`}
                      className="btn btn-ghost btn-sm"
                      style={{ flex: 1, textAlign: 'center' }}
                    >
                      View
                    </Link>
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => openEdit(t)}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={() => del(t.id, t.name)}
                      disabled={deleting === t.id}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {modal && (
          <div
            className="modal"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModal(null);
            }}
          >
            <form className="card" onSubmit={save}>
              <div className="card-title" style={{ marginBottom: '1.1rem' }}>
                {modal === 'new' ? 'Add Coach' : 'Edit Coach'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div className="form-row form-row-2">
                  <div>
                    <label>Full Name *</label>
                    <input
                      className="input"
                      value={form.name}
                      onChange={S('name')}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label>Role</label>
                    <input
                      className="input"
                      value={form.role}
                      onChange={S('role')}
                      placeholder="Personal Trainer"
                    />
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div>
                    <label>Mobile</label>
                    <input
                      className="input"
                      type="tel"
                      value={form.mobile}
                      onChange={S('mobile')}
                    />
                  </div>
                  <div>
                    <label>Email</label>
                    <input
                      className="input"
                      type="email"
                      value={form.email}
                      onChange={S('email')}
                    />
                  </div>
                </div>
                <div className="form-row form-row-3">
                  <div>
                    <label>Joining Date</label>
                    <input
                      className="input"
                      type="date"
                      value={form.joining_date}
                      onChange={S('joining_date')}
                    />
                  </div>
                  <div>
                    <label>Salary (₹)</label>
                    <input
                      className="input"
                      type="number"
                      value={form.salary}
                      onChange={S('salary')}
                    />
                  </div>
                  <div>
                    <label>Incentive %</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      value={form.incentive_rate}
                      onChange={S('incentive_rate')}
                    />
                  </div>
                </div>
                <div>
                  <label>Specialization</label>
                  <input
                    className="input"
                    value={form.specialization}
                    onChange={S('specialization')}
                    placeholder="e.g. Powerlifting, HIIT, Mobility"
                  />
                </div>
                <div>
                  <label>Status</label>
                  <select
                    className="input select"
                    value={form.status}
                    onChange={S('status')}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '.55rem', marginTop: '1.1rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ flex: 1 }}
                >
                  {saving ? 'Saving…' : modal === 'new' ? 'Create Coach' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
}
