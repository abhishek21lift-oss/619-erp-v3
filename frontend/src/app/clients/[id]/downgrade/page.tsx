'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { getStoredPlans, getMembershipPlanNames, getPlanByName, StoredPlan } from '@/lib/plans';

export default function DowngradePage() { return <Guard><Inner /></Guard>; }

// Plans loaded dynamically from localStorage via usePlans()

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ package_type: '', amount: '', reason: '' });

  const [memPlans, setMemPlans] = useState<{name:string;order:number;final:number}[]>([]);

  useEffect(() => {
    api.clients.get(id).then((c: any) => { setClient(c); setForm(f => ({ ...f, package_type: c?.package_type || '' })); }).catch(console.error).finally(() => setLoading(false));
    const stored = getStoredPlans();
    const ORDER: Record<string,number> = { Monthly:1, Quarterly:2, 'Half Yearly':3, Yearly:4 };
    const mp = stored.filter(p => p.kind === 'Membership').map((p, i) => ({
      name: p.name, final: p.final_amount, order: ORDER[p.duration] ?? i + 1
    }));
    setMemPlans(mp.length > 0 ? mp : [
      {name:'Monthly',order:1,final:2500},{name:'Quarterly',order:2,final:6500},
      {name:'Half Yearly',order:3,final:11500},{name:'Yearly',order:4,final:20000}
    ]);
  }, [id]);

  function handleDowngradePlanSelect(planName: string) {
    const plan = memPlans.find(p => p.name === planName);
    setForm(f => ({ ...f, package_type: planName, amount: plan ? String(plan.final) : f.amount }));
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.package_type) { const m = 'Pick a target plan'; setError(m); toast.error(m); return; }
    if (!form.reason)       { const m = 'Reason is required for downgrades'; setError(m); toast.error(m); return; }
    setSaving(true);
    try {
      const result = await api.clients.downgrade(id, {
        package_type: form.package_type,
        amount: parseFloat(form.amount) || 0,
        reason: form.reason,
      });
      const m = result?.message || 'Package downgraded successfully!';
      setSuccess(m); toast.success(m);
      setTimeout(() => router.push(`/clients/${id}`), 900);
    } catch (err: any) {
      const m = err?.message || 'Failed to downgrade package';
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
          <div>
            <div className="ptf-client-name">{client?.name}</div>
            <div className="ptf-client-meta">Current plan: <strong>{client?.package_type || '—'}</strong></div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ptf-card">
            <div className="ptf-card-header"><span className="ptf-card-header-icon">⬇️</span><span className="ptf-card-header-title">Downgrade Package</span></div>
            <div className="ptf-card-body">
              <div className="ptf-row-2">
                <div className="ptf-field">
                  <label className="ptf-label">New (Lower) Plan <span className="req">*</span></label>
                  <select className="ptf-select" value={form.package_type} onChange={e => handleDowngradePlanSelect(e.target.value)} required>
                    <option value="">Select Plan</option>
                    {memPlans.map(p => <option key={p.name} value={p.name}>{p.name} — ₹{p.final.toLocaleString('en-IN')}</option>)}
                  </select>
                </div>
                <div className="ptf-field">
                  <label className="ptf-label">Adjusted Amount (₹)</label>
                  <input type="number" className="ptf-input" placeholder="₹" value={form.amount} onChange={e => set('amount', e.target.value)} />
                </div>
              </div>
              <div className="ptf-field">
                <label className="ptf-label">Reason <span className="req">*</span></label>
                <textarea className="ptf-input" rows={3} placeholder="Reason for downgrade…" value={form.reason} onChange={e => set('reason', e.target.value)} required style={{ resize: 'vertical' }} />
              </div>
              {form.package_type && (
                <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '.65rem 1rem', fontSize: '.84rem', color: '#854d0e' }}>
                  ⚠️ Plan will change from <strong>{client?.package_type}</strong> → <strong>{form.package_type}</strong>
                </div>
              )}
            </div>
          </div>
          <div className="ptf-actions">
            <Link href={`/clients/${id}`} className="ptf-btn-secondary">Cancel</Link>
            <button type="submit" className="ptf-btn-primary" disabled={saving} style={{ background: '#f59e0b' }}>{saving ? 'Saving…' : '⬇️ Downgrade Package'}</button>
          </div>
        </form>
      </div></div>
    </AppShell>
  );
}
