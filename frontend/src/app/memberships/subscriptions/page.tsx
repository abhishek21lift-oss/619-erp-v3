'use client';
import { useEffect, useMemo, useState, FormEvent } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api, Client } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import {
  StoredPlan, PlanKind, PlanDuration,
  DURATIONS, DEFAULT_PLANS, PLANS_KEY,
  getStoredPlans, savePlans,
} from '@/lib/plans';

export default function SubscriptionsPage() {
  return (
    <Guard>
      <SubscriptionsContent />
    </Guard>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   BLANK PLAN factory
───────────────────────────────────────────────────────────────────────── */
function blankPlan(kind: PlanKind = 'Membership'): StoredPlan {
  return {
    id: 'p-' + Date.now(),
    kind,
    name: '',
    duration: 'Monthly',
    base_amount: 0,
    discount: 0,
    final_amount: 0,
    sessions_per_week: kind === 'PT' ? 3 : undefined,
    features: [],
    popular: false,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN CONTENT
───────────────────────────────────────────────────────────────────────── */
function SubscriptionsContent() {
  const [mainTab, setMainTab] = useState<'subscriptions' | 'plans'>('subscriptions');

  /* — Subscriptions state — */
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* — Plans state — */
  const [plans, setPlans] = useState<StoredPlan[]>([]);
  const [planTab, setPlanTab] = useState<'all' | 'Membership' | 'PT'>('all');
  const [editing, setEditing] = useState<StoredPlan | null>(null);
  const [creating, setCreating] = useState<PlanKind | null>(null);
  const [flash, setFlash] = useState('');

  /* Load data */
  useEffect(() => {
    api.clients.list({ limit: 1000 })
      .then(setClients)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    setPlans(getStoredPlans());
  }, []);

  /* Persist plans */
  useEffect(() => {
    if (plans.length > 0) savePlans(plans);
  }, [plans]);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3000);
  }

  /* ── Subscriptions filter ── */
  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return clients
      .filter((c) => c.package_type || c.pt_start_date || c.pt_end_date)
      .filter((c) => !q || c.name.toLowerCase().includes(q) ||
        (c.client_id || '').toLowerCase().includes(q) ||
        (c.mobile || '').includes(search));
  }, [clients, search]);

  /* ── Plan helpers ── */
  const visiblePlans = planTab === 'all' ? plans : plans.filter((p) => p.kind === planTab);
  const memCount = plans.filter((p) => p.kind === 'Membership').length;
  const ptCount = plans.filter((p) => p.kind === 'PT').length;

  function deletePlan(id: string) {
    if (!confirm('Delete this plan? This cannot be undone.')) return;
    setPlans((prev) => prev.filter((p) => p.id !== id));
    showFlash('Plan deleted');
  }

  function generateSet(kind: PlanKind) {
    const label = kind === 'Membership' ? 'Gym Membership' : 'Personal Training';
    if (!confirm(`Generate default ${label} plans? Existing ${kind} plans will be replaced.`)) return;
    const defaults = DEFAULT_PLANS.filter((p) => p.kind === kind);
    setPlans((prev) => [...prev.filter((p) => p.kind !== kind), ...defaults]);
    showFlash(`${label} plans generated`);
  }

  function resetAll() {
    if (!confirm('Reset ALL plans to defaults? All custom plans will be lost.')) return;
    setPlans(DEFAULT_PLANS);
    savePlans(DEFAULT_PLANS);
    showFlash('All plans reset to defaults');
  }

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up">

          {/* ── Main tab switcher ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2,#f3f4f6)', borderRadius: 10, padding: 4 }}>
              {(['subscriptions', 'plans'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setMainTab(t)}
                  style={{
                    padding: '6px 18px',
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    background: mainTab === t ? 'var(--accent,#e11d48)' : 'transparent',
                    color: mainTab === t ? '#fff' : 'var(--text-secondary,#6b7280)',
                    transition: 'all .15s',
                    textTransform: 'capitalize',
                  }}
                >
                  {t === 'subscriptions' ? `📋 Subscriptions` : `🏷️ Membership Plans`}
                </button>
              ))}
            </div>
            {mainTab === 'plans' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={resetAll}>↺ Reset Defaults</button>
                <button className="btn btn-primary btn-sm" onClick={() => setCreating('Membership')}>
                  + New Plan
                </button>
              </div>
            )}
            {mainTab === 'subscriptions' && (
              <input
                className="input"
                placeholder="Search member…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 220 }}
              />
            )}
          </div>

          {flash && <div className="alert alert-success" style={{ marginBottom: 16 }}>✓ {flash}</div>}
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          {/* ════════════════════════════════════════════
              SUBSCRIPTIONS TAB
          ════════════════════════════════════════════ */}
          {mainTab === 'subscriptions' && (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                {loading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading subscriptions...</div>
                ) : rows.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>No subscriptions found</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Member</th>
                        <th>Package</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={c.id}>
                          <td><span className="id-chip">{c.client_id || c.member_code || '-'}</span></td>
                          <td><Link href={`/clients/${c.id}`} style={{ color: 'var(--text)', fontWeight: 700, textDecoration: 'none' }}>{c.name}</Link></td>
                          <td>{c.package_type || '-'}</td>
                          <td className="text-muted">{fmtDate(c.pt_start_date)}</td>
                          <td className="text-muted">{fmtDate(c.pt_end_date)}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 700 }}>{fmtMoney(c.paid_amount)}</td>
                          <td style={{ color: Number(c.balance_amount || 0) > 0 ? 'var(--danger)' : 'var(--muted)', fontWeight: 700 }}>{fmtMoney(c.balance_amount)}</td>
                          <td><span className={`badge badge-${c.status || 'active'}`}>{c.status || 'active'}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <Link href={`/clients/${c.id}/renew-subscription`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}>🔄 Renew</Link>
                              <Link href={`/clients/${c.id}/upgrade`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}>⬆️</Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════
              MEMBERSHIP PLANS TAB
          ════════════════════════════════════════════ */}
          {mainTab === 'plans' && (
            <>
              {/* Quick-generate cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 20 }}>
                <QuickCard
                  icon="🏋️" title="Gym Membership Plans" sub={`${memCount} plan${memCount !== 1 ? 's' : ''}`}
                  color="#e11d48" colorBg="rgba(225,29,72,.08)"
                  btnLabel="⚡ Generate Default Set"
                  onBtn={() => generateSet('Membership')}
                  onNew={() => setCreating('Membership')}
                />
                <QuickCard
                  icon="💪" title="Personal Training Plans" sub={`${ptCount} plan${ptCount !== 1 ? 's' : ''}`}
                  color="#7c3aed" colorBg="rgba(124,58,237,.08)"
                  btnLabel="⚡ Generate Default Set"
                  onBtn={() => generateSet('PT')}
                  onNew={() => setCreating('PT')}
                />
              </div>

              {/* Plan type filter pills */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {(['all', 'Membership', 'PT'] as const).map((t) => (
                  <button
                    key={t}
                    className={`tab-pill ${planTab === t ? 'active' : ''}`}
                    onClick={() => setPlanTab(t)}
                  >
                    {t === 'all' ? `All · ${plans.length}` : t === 'Membership' ? `Gym · ${memCount}` : `PT · ${ptCount}`}
                  </button>
                ))}
              </div>

              {/* Plan grid */}
              {visiblePlans.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>🏷️</div>
                  <div style={{ color: 'var(--muted)', marginBottom: 16 }}>No plans yet — generate a default set or create one</div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => generateSet('Membership')}>Generate Gym Plans</button>
                    <button className="btn btn-ghost" onClick={() => generateSet('PT')}>Generate PT Plans</button>
                    <button className="btn btn-ghost" onClick={() => setCreating('Membership')}>+ Custom Plan</button>
                  </div>
                </div>
              ) : (
                <div className="plan-grid">
                  {visiblePlans.map((p) => (
                    <PlanCard
                      key={p.id}
                      plan={p}
                      onEdit={() => setEditing(p)}
                      onDelete={() => deletePlan(p.id)}
                    />
                  ))}
                  {/* Add plan tile */}
                  <div
                    onClick={() => setCreating(planTab === 'PT' ? 'PT' : 'Membership')}
                    style={{
                      border: '2px dashed var(--border-soft,var(--line))',
                      borderRadius: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      minHeight: 180,
                      cursor: 'pointer',
                      color: 'var(--muted)',
                      transition: 'border-color .15s, background .15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2,#f9fafb)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent,#e11d48)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.borderColor = ''; }}
                  >
                    <div style={{ fontSize: 28 }}>+</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>New Plan</div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── Create / Edit modal ── */}
      {(editing || creating) && (
        <PlanModal
          initial={editing || blankPlan(creating || 'Membership')}
          onClose={() => { setEditing(null); setCreating(null); }}
          onSave={(p) => {
            if (editing) {
              setPlans((prev) => prev.map((x) => (x.id === p.id ? p : x)));
              showFlash('Plan updated');
            } else {
              setPlans((prev) => [...prev, p]);
              showFlash('Plan created');
            }
            setEditing(null);
            setCreating(null);
          }}
        />
      )}
    </AppShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   QUICK CARD
───────────────────────────────────────────────────────────────────────── */
function QuickCard({ icon, title, sub, color, colorBg, btnLabel, onBtn, onNew }: {
  icon: string; title: string; sub: string;
  color: string; colorBg: string;
  btnLabel: string; onBtn: () => void; onNew: () => void;
}) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: colorBg, border: `1px solid ${color}40`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
          <div className="text-muted text-sm">{sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={onBtn}>{btnLabel}</button>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={onNew}>+ New</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   PLAN CARD
───────────────────────────────────────────────────────────────────────── */
function PlanCard({ plan: p, onEdit, onDelete }: { plan: StoredPlan; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className={`plan-card ${p.popular ? 'popular' : ''} ${p.kind === 'PT' ? 'pt' : ''}`}>
      {p.popular && <span className="plan-tag popular">★ Popular</span>}
      {!p.popular && p.kind === 'PT' && <span className="plan-tag pt">PT</span>}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{p.duration}</div>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>{p.name}</div>
      <div className="plan-price">₹{p.final_amount.toLocaleString('en-IN')}</div>
      <div className="plan-price-sub">
        {p.discount > 0 && <span style={{ textDecoration: 'line-through', marginRight: 6, color: 'var(--muted-2)' }}>₹{p.base_amount.toLocaleString('en-IN')}</span>}
        {p.discount > 0 && <span style={{ color: 'var(--success)', fontWeight: 700 }}>save ₹{p.discount.toLocaleString('en-IN')}</span>}
        {p.discount === 0 && <span>per {p.duration.toLowerCase()}</span>}
      </div>
      {p.kind === 'PT' && p.sessions_per_week && (
        <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'var(--purple-bg)', color: 'var(--purple)', marginBottom: 8, textTransform: 'uppercase' }}>
          {p.sessions_per_week}× / week
        </div>
      )}
      <ul className="plan-features">
        {p.features.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}
      </ul>
      <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 12 }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={onEdit}>✎ Edit</button>
        <button className="btn btn-danger btn-icon btn-sm" onClick={onDelete} aria-label="Delete">✕</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   PLAN MODAL
───────────────────────────────────────────────────────────────────────── */
function PlanModal({ initial, onClose, onSave }: {
  initial: StoredPlan;
  onClose: () => void;
  onSave: (p: StoredPlan) => void;
}) {
  const [p, setP] = useState<StoredPlan>(initial);
  const [featuresText, setFeaturesText] = useState(initial.features.join('\n'));

  function set<K extends keyof StoredPlan>(k: K, v: StoredPlan[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  function recalc(base: number, disc: number) {
    setP((prev) => ({ ...prev, base_amount: base, discount: disc, final_amount: Math.max(0, base - disc) }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!p.name.trim()) { alert('Plan name is required'); return; }
    if (p.final_amount <= 0) { alert('Final amount must be greater than 0'); return; }
    onSave({ ...p, features: featuresText.split('\n').map((s) => s.trim()).filter(Boolean) });
  }

  const isNew = initial.id.startsWith('p-') && !initial.name;

  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 560, width: '100%' }}>
        <div className="card-title" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{isNew ? '🏷️ Create Membership Plan' : '✎ Edit Plan'}</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Type + Duration */}
          <div className="form-row form-row-2">
            <div>
              <label>Plan Type</label>
              <select className="input select" value={p.kind} onChange={(e) => set('kind', e.target.value as PlanKind)}>
                <option value="Membership">🏋️ Gym Membership</option>
                <option value="PT">💪 Personal Training</option>
              </select>
            </div>
            <div>
              <label>Duration</label>
              <select className="input select" value={p.duration} onChange={(e) => set('duration', e.target.value as PlanDuration)}>
                {DURATIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Name */}
          <div>
            <label>Plan Name *</label>
            <input className="input" required value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Quarterly Membership" />
          </div>

          {/* Sessions (PT only) */}
          {p.kind === 'PT' && (
            <div>
              <label>Sessions per Week</label>
              <input className="input" type="number" min={1} max={7} value={p.sessions_per_week || 3} onChange={(e) => set('sessions_per_week', parseInt(e.target.value) || 3)} />
            </div>
          )}

          {/* Pricing */}
          <div className="form-row form-row-3">
            <div>
              <label>Base Price (₹)</label>
              <input className="input" type="number" min={0} value={p.base_amount} onChange={(e) => recalc(parseFloat(e.target.value) || 0, p.discount)} />
            </div>
            <div>
              <label>Discount (₹)</label>
              <input className="input" type="number" min={0} value={p.discount} onChange={(e) => recalc(p.base_amount, parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label>Final Price (₹) *</label>
              <input className="input" type="number" value={p.final_amount} readOnly style={{ fontWeight: 800, color: 'var(--accent,#e11d48)', background: 'rgba(225,29,72,.06)', borderColor: 'var(--accent,#e11d48)' }} />
            </div>
          </div>

          {/* Discount % badge */}
          {p.base_amount > 0 && p.discount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'rgba(34,197,94,.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                {Math.round((p.discount / p.base_amount) * 100)}% off
              </span>
              <span className="text-muted text-sm">Customer saves ₹{p.discount.toLocaleString('en-IN')}</span>
            </div>
          )}

          {/* Features */}
          <div>
            <label>Features <span className="text-muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(one per line)</span></label>
            <textarea className="input" rows={5} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} placeholder={'Full gym access\nLocker facility\nFree diet consult'} />
          </div>

          {/* Popular toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13, color: 'var(--text-2)', textTransform: 'none', letterSpacing: 0 }}>
            <input type="checkbox" checked={!!p.popular} onChange={(e) => set('popular', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent,#e11d48)' }} />
            ★ Mark as Most Popular
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
            {isNew ? '+ Create Plan' : '✓ Save Changes'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
