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
import { validatePlanRows } from '@/lib/validators/subscription';

export default function AddSubscriptionPage() {
  return <Guard><Inner /></Guard>;
}

// Plans loaded dynamically from localStorage via usePlans()

interface PlanRow {
  id: number;
  plan: string;
  startDate: string;
  endDate: string;
  basePrice: string;
  sellingPrice: string;
  coupon: string;
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [client, setClient] = useState<any>(null);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK'>('CASH');

  const [groupId, setGroupId] = useState('');
  const [memPlans, setMemPlans] = useState<{name:string;base:number;final:number}[]>([]);
  // Pre-fill today as the default start date — almost always what staff want,
  // and lets the End Date populate immediately when they pick a plan.
  const today = toInputDate(new Date());

  useEffect(() => {
    const stored = getStoredPlans();
    const mp = stored.filter(p => p.kind === 'Membership').map(p => ({ name: p.name, base: p.base_amount, final: p.final_amount }));
    setMemPlans(mp.length > 0 ? mp : [
      {name:'Monthly',base:2500,final:2500},{name:'Quarterly',base:7000,final:6500},
      {name:'Half Yearly',base:13000,final:11500},{name:'Yearly',base:24000,final:20000}
    ]);
  }, []);

  function handlePlanSelect(rowId: number, planName: string) {
    const plan = memPlans.find(p => p.name === planName);
    setPlanRows(r => r.map(x => {
      if (x.id !== rowId) return x;
      const start = x.startDate || today;
      return {
        ...x,
        plan: planName,
        startDate: start,
        // Always recompute end date from the new plan + current start, so
        // staff don't have to remember to clear it after switching plans.
        endDate: computeEndDate(start, planName),
        basePrice: plan ? String(plan.base) : x.basePrice,
        sellingPrice: plan ? String(plan.final) : x.sellingPrice,
      };
    }));
  }

  function handleStartDateChange(rowId: number, newStart: string) {
    setPlanRows(r => r.map(x => x.id === rowId
      ? { ...x, startDate: newStart, endDate: computeEndDate(newStart, x.plan) }
      : x
    ));
  }

  const [planRows, setPlanRows] = useState<PlanRow[]>([
    { id: 1, plan: '', startDate: '', endDate: '', basePrice: '', sellingPrice: '', coupon: '' }
  ]);

  useEffect(() => {
    Promise.all([
      api.clients.get(id),
      api.trainers.list().catch(() => []),
    ]).then(([c, t]) => {
      setClient(c);
      setTrainers(Array.isArray(t) ? t : []);
    }).catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function addPlanRow() {
    setPlanRows((r) => [...r, { id: Date.now(), plan: '', startDate: '', endDate: '', basePrice: '', sellingPrice: '', coupon: '' }]);
  }
  function removePlanRow(rowId: number) {
    if (planRows.length <= 1) return;
    setPlanRows((r) => r.filter((x) => x.id !== rowId));
  }
  function updateRow(rowId: number, field: keyof PlanRow, value: string) {
    setPlanRows((r) => r.map((x) => x.id === rowId ? { ...x, [field]: value } : x));
  }

  const totalAmount = planRows.reduce((s, r) => s + (parseFloat(r.sellingPrice) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Shared validator (lib/validators/subscription) — same rules also run
    // on the backend so this is purely a UX shortcut.
    const { error: validationError } = validatePlanRows(planRows);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const body = {
        plan_rows: planRows.map((r) => ({
          plan: r.plan,
          startDate: r.startDate,
          endDate: r.endDate,
          basePrice: parseFloat(r.basePrice) || 0,
          sellingPrice: parseFloat(r.sellingPrice) || 0,
          coupon: r.coupon || null,
        })),
        group_id: groupId || null,
        payment_method: paymentMethod,
      };

      // Goes through req() → adds NEXT_PUBLIC_API_URL, attaches the JWT,
      // throws on non-2xx, and redirects to /login on 401. None of which
      // raw fetch() did before — that's why every submit silently "worked".
      const result = await api.clients.addSubscription(id, body);

      const msg = result?.message || 'Subscription added successfully!';
      setSuccess(msg);
      toast.success(msg);
      setTimeout(() => router.push(`/clients/${id}`), 900);
    } catch (err: any) {
      const msg = err?.message || 'Failed to add subscription. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><div className="page-main" style={{ padding: '2rem', color: 'var(--muted)' }}>Loading…</div></AppShell>;

  const initials = (client?.name || 'C').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <div className="page-main">
        <div className="ptf-wrap">
          <Link href={`/clients/${id}`} className="ptf-back-btn">← Back to Member</Link>

          {success && <div className="ptf-success">✓ {success}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          {/* Client hero */}
          <div className="ptf-client-hero">
            {client?.photo_url
              ? <img src={client.photo_url} alt={client.name} className="ptf-client-avatar" />
              : <div className="ptf-client-avatar-initials">{initials}</div>
            }
            <div>
              <div className="ptf-client-name">{client?.name}</div>
              <div className="ptf-client-meta">📞 {client?.mobile || '—'} &bull; {client?.email || '—'}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Membership plans table */}
            <div className="ptf-card">
              <div className="ptf-card-header">
                <span className="ptf-card-header-icon">💳</span>
                <span className="ptf-card-header-title">Add Subscription</span>
              </div>
              <div className="ptf-card-body">
                <div style={{ overflowX: 'auto' }}>
                  <table className="ptf-plan-table">
                    <thead>
                      <tr>
                        <th className="ptf-plan-num">#</th>
                        <th>Membership Plan</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Base Price</th>
                        <th>Selling Price</th>
                        <th>Coupon</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {planRows.map((row, i) => (
                        <tr key={row.id}>
                          <td className="ptf-plan-num">{i + 1}</td>
                          <td>
                            <select className="ptf-select" value={row.plan} onChange={(e) => handlePlanSelect(row.id, e.target.value)} required>
                              <option value="">Select Membership Plan</option>
                              {memPlans.map((p) => <option key={p.name} value={p.name}>{p.name} — ₹{p.final.toLocaleString('en-IN')}</option>)}
                            </select>
                          </td>
                          <td><input type="date" className="ptf-input" value={row.startDate} onChange={(e) => handleStartDateChange(row.id, e.target.value)} required /></td>
                          <td><input type="date" className="ptf-input" value={row.endDate} onChange={(e) => updateRow(row.id, 'endDate', e.target.value)} /></td>
                          <td><input type="number" className="ptf-input" placeholder="₹" value={row.basePrice} onChange={(e) => updateRow(row.id, 'basePrice', e.target.value)} /></td>
                          <td><input type="number" className="ptf-input" placeholder="₹" value={row.sellingPrice} onChange={(e) => updateRow(row.id, 'sellingPrice', e.target.value)} required /></td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <input type="text" className="ptf-input" placeholder="Code" value={row.coupon} onChange={(e) => updateRow(row.id, 'coupon', e.target.value)} />
                              <button type="button" style={{ padding: '0 .5rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '.75rem', whiteSpace: 'nowrap' }}>Apply</button>
                            </div>
                          </td>
                          <td>
                            {planRows.length > 1 && (
                              <button type="button" onClick={() => removePlanRow(row.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 1.1 + 'rem', lineHeight: 1 }}>✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addPlanRow} style={{ alignSelf: 'flex-start', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, padding: '.4rem .9rem', fontWeight: 700, cursor: 'pointer', fontSize: '.8rem' }}>
                  + Add more plan
                </button>

                {/* Group ID */}
                <div className="ptf-field" style={{ marginTop: '.5rem' }}>
                  <label className="ptf-label">Group Members Id</label>
                  <input className="ptf-input" placeholder="Enter Member Code" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button type="button" style={{ fontSize: '.75rem', padding: '.3rem .65rem', border: '1.5px solid var(--accent)', color: 'var(--accent)', background: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>🔍 Lookup Member code</button>
                    <button type="button" style={{ fontSize: '.75rem', padding: '.3rem .65rem', border: '1.5px solid var(--accent)', color: 'var(--accent)', background: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>🔍 Lookup Enquiry code</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment method + breakdown */}
            <div className="ptf-card">
              <div className="ptf-card-header">
                <span className="ptf-card-header-icon">₹</span>
                <span className="ptf-card-header-title">Payment Breakdown</span>
              </div>
              <div className="ptf-card-body">
                <div className="ptf-field" style={{ marginBottom: '0.75rem' }}>
                  <label className="ptf-label">Payment Method</label>
                  <select
                    className="ptf-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="BANK">Bank transfer</option>
                  </select>
                </div>

                {(() => {
                  const mrp = planRows.reduce((s, r) => s + (parseFloat(r.basePrice) || 0), 0);
                  const net = totalAmount;
                  const discount = Math.max(0, mrp - net);
                  return (
                    <div className="ptf-breakdown">
                      <div className="ptf-breakdown-row"><span>MRP</span><span className="ptf-breakdown-val">₹ {mrp.toLocaleString('en-IN')}</span></div>
                      <div className="ptf-breakdown-row"><span>Discount</span><span className="ptf-breakdown-val">₹ {discount.toLocaleString('en-IN')}</span></div>
                      <div className="ptf-breakdown-row"><span>Net Sales Amount</span><span className="ptf-breakdown-val">₹ {net.toLocaleString('en-IN')}</span></div>
                      <div className="ptf-breakdown-row total"><span>Total Amount to be Paid</span><span>₹ {net.toLocaleString('en-IN')}</span></div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="ptf-actions">
              <Link href={`/clients/${id}`} className="ptf-btn-secondary">Cancel</Link>
              <button type="submit" className="ptf-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Subscription'}</button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
