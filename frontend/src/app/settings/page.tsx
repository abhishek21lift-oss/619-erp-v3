'use client';
import { useEffect, useState, FormEvent } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, User, Trainer } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function SettingsPage() {
  return (
    <Guard>
      <SettingsContent />
    </Guard>
  );
}

function SettingsContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [users, setUsers] = useState<User[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<'accounts' | 'password'>(isAdmin ? 'accounts' : 'password');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);

  const EMPTY = {
    name: '',
    email: '',
    password: '',
    role: 'trainer' as 'admin' | 'trainer',
    trainer_id: '',
  };
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadAll = () => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([api.auth.listUsers(), api.trainers.list()])
      .then(([u, t]) => {
        setUsers(u);
        setTrainers(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(loadAll, [isAdmin]);

  function flash(msg: string, isError = false) {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 4000);
  }

  async function createUser(e: FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return flash('All fields required', true);
    if (form.password.length < 6)
      return flash('Password must be at least 6 characters', true);
    setSaving(true);
    try {
      await api.auth.createUser(form);
      flash(`Login created for ${form.email}`);
      setForm(EMPTY);
      loadAll();
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(u: User) {
    try {
      await api.auth.toggleUser(u.id);
      flash(`${u.name} ${u.is_active ? 'disabled' : 'enabled'}`);
      loadAll();
    } catch (e: any) {
      flash(e.message, true);
    }
  }

  async function deleteUser(u: User) {
    setConfirmDeleteUser(null);
    try {
      await api.auth.deleteUser(u.id);
      flash(`${u.name} deleted`);
      loadAll();
    } catch (e: any) {
      flash(e.message, true);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (!pwForm.current) return flash('Enter your current password', true);
    if (pwForm.newPw !== pwForm.confirm) return flash('New passwords do not match', true);
    if (pwForm.newPw.length < 6)
      return flash('Password must be at least 6 characters', true);
    if (pwForm.newPw === pwForm.current)
      return flash('New password must be different from current', true);
    setPwSaving(true);
    try {
      await api.auth.changePassword(pwForm.current, pwForm.newPw);
      flash('Password changed successfully');
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (e: any) {
      flash(e.message, true);
    } finally {
      setPwSaving(false);
    }
  }

  const S = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const SP = (k: keyof typeof pwForm) => (e: React.ChangeEvent<any>) =>
    setPwForm((f) => ({ ...f, [k]: e.target.value }));

  const strength = (pw: string) => {
    let s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
  };
  const pwStrength = strength(pwForm.newPw);
  const strengthLabel = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'][pwStrength];
  const strengthColor = [
    'var(--danger)',
    'var(--danger)',
    'var(--warning)',
    'var(--success)',
    'var(--success)',
  ][pwStrength];

  const tabs: [string, string][] = isAdmin
    ? [
        ['accounts', 'Login Accounts'],
        ['password', 'Change Password'],
      ]
    : [['password', 'Change Password']];

  return (
    <AppShell>
      <div className="page-main">

        <div className="page-content fade-up">
          {error && <div className="alert alert-error">⚠ {error}</div>}
          {success && <div className="alert alert-success">✓ {success}</div>}

          <div
            style={{
              display: 'flex',
              gap: '.4rem',
              marginBottom: '1.4rem',
              padding: '.3rem',
              background: 'var(--bg-3)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              width: 'fit-content',
            }}
          >
            {tabs.map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setTab(k as any)}
                style={{
                  padding: '.45rem 1rem',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: tab === k ? 'var(--brand)' : 'transparent',
                  color: tab === k ? 'var(--on-brand)' : 'var(--text-2)',
                  boxShadow: tab === k ? '0 4px 12px var(--brand-glow2)' : 'none',
                  transition: 'all .15s',
                  fontFamily: 'inherit',
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          {tab === 'accounts' && isAdmin && (
            <div
              style={{
                display: 'grid',
                gap: '1.4rem',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
              }}
            >
              <div className="card">
                <div className="card-title">Create Login Account</div>
                <form
                  onSubmit={createUser}
                  style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}
                >
                  <div>
                    <label>Full Name</label>
                    <input
                      className="input"
                      value={form.name}
                      onChange={S('name')}
                      required
                      placeholder="e.g. Riya Sharma"
                    />
                  </div>
                  <div>
                    <label>Email</label>
                    <input
                      className="input"
                      type="email"
                      value={form.email}
                      onChange={S('email')}
                      required
                      placeholder="riya@619fitness.com"
                    />
                  </div>
                  <div>
                    <label>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input"
                        type={showPw ? 'text' : 'password'}
                        value={form.password}
                        onChange={S('password')}
                        required
                        minLength={6}
                        placeholder="Min 6 characters"
                        style={{ paddingRight: '2.75rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase',
                          padding: '4px 8px',
                          borderRadius: 5,
                        }}
                      >
                        {showPw ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label>Role</label>
                    <select className="input select" value={form.role} onChange={S('role')}>
                      <option value="trainer">Coach</option>
                      <option value="admin">Owner / Admin</option>
                    </select>
                  </div>
                  {form.role === 'trainer' && (
                    <div>
                      <label>Link to Coach Profile</label>
                      <select
                        className="input select"
                        value={form.trainer_id}
                        onChange={S('trainer_id')}
                      >
                        <option value="">— Not linked —</option>
                        {trainers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-muted text-xs mt-1">
                        Linking restricts the coach to see only their own clients.
                      </div>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={saving}
                    style={{ marginTop: 6, justifyContent: 'center' }}
                  >
                    {saving ? 'Creating…' : '+ Create Account'}
                  </button>
                </form>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '0.95rem 1.4rem',
                    borderBottom: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div className="card-title" style={{ marginBottom: 0 }}>
                    All Accounts ({users.length})
                  </div>
                </div>
                {loading ? (
                  <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading…</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {users.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '.85rem',
                          padding: '.85rem 1.4rem',
                          borderBottom: '1px solid var(--line)',
                          opacity: u.is_active ? 1 : 0.55,
                          transition: 'background .15s',
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 9,
                            flexShrink: 0,
                            background:
                              u.role === 'admin'
                                ? 'linear-gradient(135deg, var(--brand), var(--purple))'
                                : 'linear-gradient(135deg, var(--info), #1d4ed8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#fff',
                          }}
                        >
                          {(u.name || 'U')
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{ fontWeight: 600, fontSize: 13 }}
                            className="truncate"
                          >
                            {u.name}
                          </div>
                          <div className="text-muted text-xs truncate">{u.email}</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            <span className={`badge badge-${u.role}`} style={{ fontSize: 10 }}>
                              {u.role}
                            </span>
                            <span
                              className={`badge ${u.is_active ? 'badge-active' : 'badge-disabled'}`}
                              style={{ fontSize: 10 }}
                            >
                              {u.is_active ? 'active' : 'disabled'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {u.id !== user?.id && (
                            <>
                              <button
                                onClick={() => toggleUser(u)}
                                className={`btn ${
                                  u.is_active ? 'btn-ghost' : 'btn-success'
                                } btn-sm`}
                                style={{ fontSize: 11 }}
                              >
                                {u.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteUser(u)}
                                className="btn btn-danger btn-icon btn-sm"
                                aria-label="Delete user"
                              >
                                ✕
                              </button>
                            </>
                          )}
                          {u.id === user?.id && (
                            <span
                              className="text-muted text-xs"
                              style={{ alignSelf: 'center' }}
                            >
                              (you)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'password' && (
            <div style={{ maxWidth: 500 }}>
              <div className="card">
                <div className="card-title">Change Your Password</div>
                <div className="alert alert-info mb-2">
                  ⚙ Changing password for <strong>{user?.email}</strong>
                </div>
                <form
                  onSubmit={changePassword}
                  style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}
                >
                  <PwField
                    label="Current Password"
                    value={pwForm.current}
                    onChange={SP('current')}
                    show={showCurrent}
                    onToggle={() => setShowCurrent(!showCurrent)}
                    autoComplete="current-password"
                  />

                  <div>
                    <PwField
                      label="New Password"
                      value={pwForm.newPw}
                      onChange={SP('newPw')}
                      show={showNew}
                      onToggle={() => setShowNew(!showNew)}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                    />
                    {pwForm.newPw && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 4,
                                background:
                                  i < pwStrength ? strengthColor : 'var(--bg-4)',
                                transition: 'background .2s',
                              }}
                            />
                          ))}
                        </div>
                        <div
                          className="text-xs"
                          style={{
                            color: strengthColor,
                            fontWeight: 700,
                            letterSpacing: '0.3px',
                          }}
                        >
                          {strengthLabel}
                        </div>
                      </div>
                    )}
                  </div>

                  <PwField
                    label="Confirm New Password"
                    value={pwForm.confirm}
                    onChange={SP('confirm')}
                    show={showConfirm}
                    onToggle={() => setShowConfirm(!showConfirm)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />

                  {pwForm.newPw &&
                    pwForm.confirm &&
                    pwForm.newPw !== pwForm.confirm && (
                      <div className="alert alert-error" style={{ margin: 0 }}>
                        Passwords do not match
                      </div>
                    )}

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={
                      pwSaving ||
                      !pwForm.current ||
                      !pwForm.newPw ||
                      !pwForm.confirm ||
                      pwForm.newPw !== pwForm.confirm ||
                      pwForm.newPw.length < 6
                    }
                    style={{ justifyContent: 'center' }}
                  >
                    {pwSaving ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {confirmDeleteUser && (
          <div
            className="modal-overlay"
            onClick={() => setConfirmDeleteUser(null)}
          >
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 420 }}
            >
              <div className="modal-header">
                <div className="modal-title">Delete login account?</div>
                <button
                  onClick={() => setConfirmDeleteUser(null)}
                  className="btn btn-ghost btn-icon btn-sm"
                >
                  ✕
                </button>
              </div>
              <div className="alert alert-warning">
                Delete login for <strong>{confirmDeleteUser.name}</strong>? They will
                no longer be able to sign in.
              </div>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
                <button
                  onClick={() => deleteUser(confirmDeleteUser)}
                  className="btn btn-danger btn-lg"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDeleteUser(null)}
                  className="btn btn-ghost btn-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PwField({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<any>) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required
          minLength={6}
          placeholder={placeholder || ''}
          autoComplete={autoComplete}
          style={{ paddingRight: '3rem' }}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            padding: '4px 8px',
            borderRadius: 5,
          }}
          aria-label="Toggle password"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}
