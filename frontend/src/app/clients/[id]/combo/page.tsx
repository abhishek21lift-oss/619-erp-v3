'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { getStoredPlans } from '@/lib/plans';
import { computeEndDate, toInputDate } from '@/lib/format';

export default function ComboPage() { return <Guard><Inner /></Guard>; }

// Combo plans loaded dynamically

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [comboPlans, setComboPlans] = useState<{name:string;final:number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ package_type: 'Half Yearly', trainer_id: '', amount: '', start_date: '', end_date: '', notes: '' });

  useEffect(() => {
    Promise.all([api.clients.get(id), api.trainers.list().catch(() => [])])
      .then(([c, t]) => { setClient(c); setTrainers(Array.isArray(t) ? t : []); })
      .catch(console.error).finally(() => setLoading(false));
  }, [id]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function handlePlanSelect(planName: string) {
    setForm(f => {
      const start = f.start_date || toInputDate(new Date());
      return { ...f, package_type: planName, start_date: start, end_date: computeEndDate(start, planName) };
    });
  }
  function handleStartDate(newStart: string) {
    setForm(f => ({ ...f, start_date: newStart, end_date: computeEndDate(newStart, f.package_type) }));
  }

  const total = parseFloat(form.amount) || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.package_type) { const m = 'Pick a combo plan'; setError(m); toast.error(m); return; }
    setSaving(true);
    try {
      const result = await api.clients.combo(id, {
        combo_plan: form.package_type,
        trainer_id: form.trainer_id || null,
        amount: parseFloat(form.amount) || 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
      });
      const m = result?.message || 'Combo offer applied successfully!';
      setSuccess(m); toast.success(m);
      setTimeout(() => router.push(`/clients/${id}`), 900);
    } catch (err: any) {
      const m = err?.message || 'Failed to apply combo offer';
      setError(m); toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><div className="page-main" style={{ padding: '2rem' }}>Loading…</div></AppShell>;
  const initials = (client?.name || 'C').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <div className="page-main"><div className="ptf-wrap">
        <Link href={`/clients/${id}`} className="ptf-back-btn">← Back to Member</Link>
        {success && <div className="ptf-success">✓ {success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="ptf-client-hero">
          {client?.photo_url ? <img src={client.photo_url} alt="" className="ptf-client-avatar" /> : <div className="ptf-client-avatar-initials">{initials}</div>}
          <div><div className="ptf-client-name">{client?.name}</div><div className="ptf-client-meta">📞 {client?.mobile || '—'}</div></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ptf-card">
            <div className="ptf-card-header"><span className="ptf-card-header-icon">🎁</span><span className="ptf-card-header-title">Upgrade to Combo Offer</span></div>
            <div className="ptf-card-body">
              <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.84rem', color: '#7c3aed', marginBottom: '.5rem' }}>
                🎁 Combo Offer = Gym Membership + Personal Training bundled at a special price.
              </div>
              <div className="ptf-row-2">
                <div className="ptf-field">
                  <label className="ptf-label">Combo Plan <span className="req">*</span></label>
                  <select className="ptf-select" value={form.package_type} onChange={e => handlePlanSelect(e.target.value)} required>
                    {comboPlans.map(p => <option key={p.name} value={p.name}>{p.name} — ₹{p.final.toLocaleString('en-IN')}</option>)}
                  </select>
                </div>
                <div className="ptf-field">
                  <label className="ptf-label">Assign Trainer <span className="req">*</span></label>
                  <select className="ptf-select" value={form.trainer_id} onChange={e => set('trainer_id', e.target.value)} required>
                    <option value="">Select Trainer</option>
                    {trainers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="ptf-row-2">
                <div className="ptf-field">
                  <label className="ptf-label">Start Date <span className="req">*</span></label>
                  <input type="date" className="ptf-input" value={form.start_date} onChange={e => handleStartDate(e.target.value)} required />
                </div>
                <div className="ptf-field">
                  <label className="ptf-label">End Date</label>
                  <input type="date" className="ptf-input" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
              </div>
              <div className="ptf-row-2">
                <div className="ptf-field">
                  <label className="ptf-label">Combo Amount (₹) <span className="req">*</span></label>
                  <input type="number" className="ptf-input" placeholder="₹" value={form.amount} onChange={e => set('amount', e.target.value)} required />
                </div>
              </div>
              <div className="ptf-field">
                <label className="ptf-label">Notes</label>
                <textarea className="ptf-input" rows={2} placeholder="Any special terms or notes…" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>
          <div className="ptf-card">
            <div className="ptf-card-header"><span className="ptf-card-header-icon">₹</span><span className="ptf-card-header-title">Payment Breakdown</span></div>
            <div className="ptf-card-body">
              <div className="ptf-breakdown">
                <div className="ptf-breakdown-row"><span>Combo Price</span><span className="ptf-breakdown-val">₹ {total.toLocaleString('en-IN')}</span></div>
                <div className="ptf-breakdown-row"><span>Sign Up Fee</span><span className="ptf-breakdown-val">₹ 0</span></div>
                <div className="ptf-breakdown-row"><span>—CGST @</span><span className="ptf-breakdown-val">₹ 0</span></div>
                <div className="ptf-breakdown-row"><span>—SGST @</span><span className="ptf-breakdown-val">₹ 0</span></div>
                <div className="ptf-breakdown-row total"><span>Total Amount to be Paid</span><span>₹ {total.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
          </div>
          <div className="ptf-actions">
            <Link href={`/clients/${id}`} className="ptf-btn-secondary">Cancel</Link>
            <button type="submit" className="ptf-btn-primary" disabled={saving} style={{ background: '#7c3aed' }}>{saving ? 'Saving…' : '🎁 Apply Combo Offer'}</button>
          </div>
        </form>
      </div></div>
    </AppShell>
  );
}
