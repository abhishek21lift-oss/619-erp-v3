'use client';
import { useEffect, useState, FormEvent } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Payment, Client } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate } from '@/lib/format';

export default function PaymentsPage() {
  return (
    <Guard>
      <PaymentsContent />
    </Guard>
  );
}

function PaymentsContent() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterFrom, setFrom] = useState('');
  const [filterTo, setTo] = useState('');
  const isAdmin = user?.role === 'admin';

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    client_id: '',
    amount: '',
    method: 'CASH',
    date: today,
    notes: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        api.payments.list({
          from: filterFrom || undefined,
          to: filterTo || undefined,
        }),
        api.clients.list({ status: 'active' }),
      ]);
      setPayments(p);
      setClients(c);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [filterFrom, filterTo]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.payments.create({ ...form, amount: parseFloat(form.amount) });
      setSuccess('Payment recorded.');
      setForm({ client_id: '', amount: '', method: 'CASH', date: today, notes: '' });
      setShowForm(false);
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this payment? Member balance will be adjusted.')) return;
    try {
      await api.payments.delete(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const fmt = (n: number) =>
    '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
  const todayRevenue = payments
    .filter((p) => p.date === today)
    .reduce((s, p) => s + Number(p.amount), 0);
  const S = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AppShell>
      <div className="page-main">

        <div className="page-content fade-up">
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {showForm && (
            <div className="card mb-3">
              <div className="card-title">Record New Payment</div>
              <form onSubmit={handleAdd}>
                <div className="form-row form-row-3">
                  <div>
                    <label>Member *</label>
                    <select
                      className="input select"
                      value={form.client_id}
                      onChange={S('client_id')}
                      required
                    >
                      <option value="">Select member…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.client_id})
                          {Number(c.balance_amount || 0) > 0
                            ? ` — Due: ${fmt(Number(c.balance_amount))}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Amount (₹) *</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={form.amount}
                      onChange={S('amount')}
                      required
                      style={{ fontWeight: 700, color: 'var(--success)' }}
                    />
                    {form.client_id && (
                      <div className="text-muted text-xs mt-1">
                        Due:{' '}
                        {fmt(
                          Number(
                            clients.find((c) => c.id === form.client_id)
                              ?.balance_amount || 0,
                          ),
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label>Method</label>
                    <select className="input select" value={form.method} onChange={S('method')}>
                      <option>CASH</option>
                      <option>UPI</option>
                      <option>CARD</option>
                      <option>BANK_TRANSFER</option>
                    </select>
                  </div>
                  <div>
                    <label>Date</label>
                    <input
                      className="input"
                      type="date"
                      value={form.date}
                      onChange={S('date')}
                      required
                    />
                  </div>
                  <div>
                    <label>Notes</label>
                    <input
                      className="input"
                      value={form.notes}
                      onChange={S('notes')}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '.65rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : '◈ Record Payment'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: '.65rem',
              marginBottom: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              Filter by date
            </div>
            <input
              className="input"
              type="date"
              value={filterFrom}
              onChange={(e) => setFrom(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <span className="text-muted">→</span>
            <input
              className="input"
              type="date"
              value={filterTo}
              onChange={(e) => setTo(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            {(filterFrom || filterTo) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setFrom('');
                  setTo('');
                }}
              >
                Clear
              </button>
            )}
            <div
              style={{
                marginLeft: 'auto',
                fontWeight: 700,
                color: 'var(--success)',
                fontSize: 14,
              }}
              className="tabular"
            >
              Total: {fmt(totalRevenue)}
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
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
              ) : payments.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: 26, marginBottom: 12, opacity: 0.5 }}>◈</div>
                  <div className="text-muted">No payments recorded yet</div>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Member</th>
                      <th>Amount</th>
                      <th>Method</th>
                      {isAdmin && <th>Coach</th>}
                      <th>Date</th>
                      <th>Notes</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className="mono text-muted text-xs">
                            {p.receipt_no || '—'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.client_name || '—'}</td>
                        <td
                          style={{
                            fontWeight: 700,
                            color: 'var(--success)',
                            fontSize: 14.5,
                          }}
                          className="tabular"
                        >
                          {fmt(p.amount)}
                        </td>
                        <td>
                          <span
                            className={`badge badge-${(p.method || 'cash').toLowerCase()}`}
                          >
                            {p.method}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="text-muted">
                            {(p as any).trainer_name_full || '—'}
                          </td>
                        )}
                        <td className="text-muted tabular">{fmtDate(p.date)}</td>
                        <td className="text-muted text-sm">{p.notes || '—'}</td>
                        <td>
                          {isAdmin && (
                            <button
                              onClick={() => del(p.id)}
                              className="btn btn-danger btn-icon btn-sm"
                              title="Delete"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div className="text-muted text-sm mt-1">
            {payments.length} payment{payments.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
