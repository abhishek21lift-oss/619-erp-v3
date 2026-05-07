'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { getStoredPlans, getMembershipPlanNames, getPlanByName, StoredPlan } from '@/lib/plans';
import { computeEndDate, toInputDate } from '@/lib/format';

export default function UpgradePage() { return <Guard><Inner /></Guard>; }

// Plans loaded dynamically from localStorage via usePlans()
const PLAN_ORDER: Record<string,number> = { Monthly:1, Quarterly:2, 'Half Yearly':3, Yearly:4 };

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ package_type: 'Yearly', amount: '', start_date: '', end_date: '', reason: '' });

  const [memPlans, setMemPlans] = useState<{name:string;order:number;final:number}[]>([]);

  useEffect(() => {
    api.clients.get(id).then(setClient).catch(console.error).finally(() => setLoading(false));
    const stored = getStoredPlans();
    const ORDER: Record<string,number> = { Monthly:1, Quarterly:2, 'Half Yearly':3, Yearly:4 };
    const mp = stored.filter(p => p.kind === 'Membership').map((p, i) => ({
      name: p.name, final: p.final_amount,
      order: ORDER[p.duration] ?? i + 1
    }));
    setMemPlans(mp.length > 0 ? mp : [
      {name:'Monthly',order:1,final:2500},{name:'Quarterly',order:2,final:6500},
      {name:'Half Yearly',order:3,final:11500},{name:'Yearly',order:4,final:20000}
    ]);
  }, [id]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function handleUpgradePlanSelect(planName: string) {
    const plan = memPlans.find(p => p.name === planName);
    setForm(f => {
      const start = f.start_date || toInputDate(new Date());
      return {
        ...f,
        package_type: planName,
        start_date: start,
        end_date: computeEndDate(start, planName),
        amount: plan ? String(plan.final) : f.amount,
      };
    });
  }

  function handleStartDate(newStart: string) {
    setForm(f => ({ ...f, start_date: newStart, end_date: computeEndDate(newStart, f.package_type) }));
  }

  const totalAmount = parseFloat(form.amount) || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.package_type) { const m = 'Pick a target plan'; setError(m); toast.error(m); return; }
    setSaving(true);
    try {
      const result = await api.clients.upgrade(id, {
        package_type: form.package_type,
        amount: parseFloat(form.amount) || 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        reason: form.reason || null,
      });
      const m = result?.message || `Package upgraded to ${form.package_type}!`;
      setSuccess(m); toast.success(m);
      setTimeout(() => router.push(`/clients/${id}`), 900);
    } catch (err: any) {
      const m = err?.message || 'Failed to upgrade package';
      setError(m); toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><div className="page-main" style={{ padding: '2rem' }}>Loading…</div></AppShell>;
  const initials = (client?.name || 'C').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const clientPlanOrder = memPlans.find(p => p.name === client?.package_type)?.order ?? 0;
  const upgradePlans = memPlans.filter(p => p.order > clientPlanOrder);

  return (
    <AppShell>
      <div className="page-main"><div className="ptf-wrap">
        <Link href={`/clients/${id}`} className="ptf-back-btn">← Back to Member</Link>
        {success && <div className="ptf-success">✓ {success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="ptf-client-hero">
          {client?.photo_url ? <img src={client.photo_url} alt="" className="ptf-client-avatar" /> : <div className="ptf-client-avatar-initials">{initials}</div>}
          <div>
            <div className="ptf-client-name">{client?.name}</div>
            <div className="ptf-client-meta">Current plan: <strong>{client?.package_type || '—'}</strong></div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ptf-card">
            <div className="ptf-card-header"><span className="ptf-card-header-icon">⬆️</span><span className="ptf-card-header-title">Upgrade Package</span></div>
            <div className="ptf-card-body">
              <div className="ptf-row-2">
                <div className="ptf-field">
                  <label className="ptf-label">Upgrade To Plan <span className="req">*</span></label>
                  <select className="ptf-select" value={form.package_type} onChange={e => handleUpgradePlanSelect(e.target.value)} required>
                    <option value="">Select Plan</option>
                    {(upgradePlans.length > 0 ? upgradePlans : memPlans).map(p => <option key={p.name} value={p.name}>{p.name} — ₹{p.final.toLocaleString('en-IN')}</option>)}
                  </select>
                </div>
                <div className="ptf-field">
                  <label className="ptf-label">Amount (₹) <span className="req">*</span></label>
                  <input type="number" className="ptf-input" placeholder="₹" value={form.amount} onChange={e => set('amount', e.target.value)} required />
                </div>
              </div>
              <div className="ptf-row-2">
                <div className="ptf-field">
                  <label className="ptf-label">Start Date</label>
                  <input type="date" className="ptf-input" value={form.start_date} onChange={e => handleStartDate(e.target.value)} />
                </div>
                <div className="ptf-field">
                  <label className="ptf-label">End Date</label>
                  <input type="date" className="ptf-input" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
              </div>
              {form.package_type && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '.65rem 1rem', fontSize: '.84rem', color: '#15803d' }}>
                  ⬆️ Upgrading: <strong>{client?.package_type || '—'}</strong> → <strong>{form.package_type}</strong>
                </div>
              )}
              <div className="ptf-field">
                <label className="ptf-label">Reason / Notes</label>
                <textarea className="ptf-input" rows={2} placeholder="Optional note…" value={form.reason} onChange={e => set('reason', e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="ptf-card">
            <div className="ptf-card-header"><span className="ptf-card-header-icon">₹</span><span className="ptf-card-header-title">Payment Breakdown</span></div>
            <div className="ptf-card-body">
              <div className="ptf-breakdown">
                <div className="ptf-breakdown-row"><span>Upgrade Amount</span><span className="ptf-breakdown-val">₹ {totalAmount.toLocaleString('en-IN')}</span></div>
                <div className="ptf-breakdown-row"><span>—CGST @</span><span className="ptf-breakdown-val">₹ 0</span></div>
                <div className="ptf-breakdown-row"><span>—SGST @</span><span className="ptf-breakdown-val">₹ 0</span></div>
                <div className="ptf-breakdown-row total"><span>Total Amount to be Paid</span><span>₹ {totalAmount.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
          </div>

          <div className="ptf-actions">
            <Link href={`/clients/${id}`} className="ptf-btn-secondary">Cancel</Link>
            <button type="submit" className="ptf-btn-primary" disabled={saving}>{saving ? 'Saving…' : '⬆️ Upgrade Package'}</button>
          </div>
        </form>
      </div></div>
    </AppShell>
  );
}
