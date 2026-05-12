'use client';
/**
 * Membership Plans Page — premium SaaS rebuild.
 * Manages gym membership & PT plans stored in localStorage via /lib/plans.
 */
import { useState, useEffect, FormEvent } from 'react';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import {
  StoredPlan, PlanKind, PlanDuration,
  DURATIONS, DEFAULT_PLANS, PLANS_KEY,
} from '@/lib/plans';
import {
  Plus, Edit2, Trash2, Star, Zap, Package, X, CheckCircle,
} from 'lucide-react';

/* ─── Helpers ───────────────────────────────────────────── */
function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

/* ─── Plan Card ─────────────────────────────────────────── */
function PlanCard({
  plan, onEdit, onDelete,
}: {
  plan: StoredPlan;
  onEdit: (p: StoredPlan) => void;
  onDelete: (id: string) => void;
}) {
  const isPT = plan.kind === 'PT';
  const accentColor = isPT ? '#7c3aed' : 'var(--brand)';

  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${plan.popular ? accentColor : 'var(--border)'}`,
      background: 'var(--bg-card)',
      padding: '22px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      position: 'relative',
      boxShadow: plan.popular ? `0 4px 20px ${accentColor}22` : 'var(--shadow-sm)',
      transition: 'box-shadow 150ms',
    }}>
      {/* Badge */}
      {plan.popular && (
        <span style={{
          position: 'absolute', top: -10, left: 16,
          background: accentColor, color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
          letterSpacing: '0.3px',
        }}>
          ★ Popular
        </span>
      )}
      {!plan.popular && isPT && (
        <span style={{
          position: 'absolute', top: -10, left: 16,
          background: '#7c3aed', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
        }}>
          Personal Training
        </span>
      )}

      {/* Duration badge */}
      <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        {plan.duration}
      </div>

      {/* Name */}
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{plan.name}</div>

      {/* Price */}
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: accentColor, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {fmtINR(plan.final_amount)}
        </div>
        {plan.discount > 0 && (
          <div style={{ fontSize: 12, marginTop: 3, display: 'flex', gap: 6 }}>
            <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{fmtINR(plan.base_amount)}</span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>save {fmtINR(plan.discount)}</span>
          </div>
        )}
      </div>

      {/* PT sessions */}
      {isPT && plan.sessions_per_week && (
        <div style={{
          display: 'inline-block', padding: '3px 10px',
          background: 'rgba(124,58,237,0.1)', color: '#7c3aed',
          borderRadius: 999, fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.3px',
        }}>
          {plan.sessions_per_week}× sessions / week
        </div>
      )}

      {/* Features */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {plan.features.slice(0, 5).map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            <CheckCircle size={11} style={{ flexShrink: 0, color: accentColor }} /> {f}
          </li>
        ))}
        {plan.features.length > 5 && (
          <li style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{plan.features.length - 5} more</li>
        )}
      </ul>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => onEdit(plan)}>
          <Edit2 size={12} /> Edit
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => onDelete(plan.id)}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/* ─── Plan Modal ─────────────────────────────────────────── */
function PlanModal({
  initial, onClose, onSave,
}: {
  initial: StoredPlan;
  onClose: () => void;
  onSave: (p: StoredPlan) => void;
}) {
  const [p, setP]                   = useState<StoredPlan>(initial);
  const [featuresText, setFeatures] = useState(initial.features.join('\n'));

  function set<K extends keyof StoredPlan>(k: K, v: StoredPlan[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  function recalc(base: number, disc: number) {
    setP((prev) => ({ ...prev, base_amount: base, discount: disc, final_amount: Math.max(0, base - disc) }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!p.name.trim()) { alert('Plan name is required'); return; }
    if (p.final_amount <= 0) { alert('Final amount must be > 0'); return; }
    const features = featuresText.split('\n').map((s) => s.trim()).filter(Boolean);
    onSave({ ...p, features });
  }

  const isNew = initial.id.startsWith('p-') && !initial.name;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 className="modal-title">{isNew ? 'Create Plan' : 'Edit Plan'}</h3>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Plan Type</label>
                <select className="input" value={p.kind} onChange={(e) => set('kind', e.target.value as PlanKind)}>
                  <option value="Membership">Gym Membership</option>
                  <option value="PT">Personal Training</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <select className="input" value={p.duration} onChange={(e) => set('duration', e.target.value as PlanDuration)}>
                  {DURATIONS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Plan Name *</label>
              <input className="input" required value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Quarterly Premium" />
            </div>

            {p.kind === 'PT' && (
              <div className="form-group">
                <label className="form-label">Sessions per Week</label>
                <input className="input" type="number" min={1} max={7} value={p.sessions_per_week || 3}
                  onChange={(e) => set('sessions_per_week', parseInt(e.target.value) || 3)} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Base (₹)</label>
                <input className="input" type="number" min={0} value={p.base_amount}
                  onChange={(e) => recalc(parseFloat(e.target.value) || 0, p.discount)} />
              </div>
              <div className="form-group">
                <label className="form-label">Discount (₹)</label>
                <input className="input" type="number" min={0} value={p.discount}
                  onChange={(e) => recalc(p.base_amount, parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label className="form-label">Final (₹)</label>
                <input className="input" type="number" value={p.final_amount} readOnly
                  style={{ borderColor: 'var(--brand)', fontWeight: 700, color: 'var(--brand)', background: 'rgba(220,38,38,0.04)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Features (one per line)</label>
              <textarea className="input" rows={5} value={featuresText} onChange={(e) => setFeatures(e.target.value)}
                placeholder={'Full gym access\nLocker facility\nFree diet consult'} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={!!p.popular} onChange={(e) => set('popular', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--brand)' }} />
              Mark as Most Popular
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Save Plan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Quick-action card ─────────────────────────────────── */
function ActionCard({ icon, title, desc, count, label, onClick, color }: {
  icon: React.ReactNode; title: string; desc: string; count: string; label: string;
  onClick: () => void; color: string;
}) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 18 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count}</div>
      <button className="btn btn-primary btn-sm" onClick={onClick} style={{ width: '100%', justifyContent: 'center' }}>
        <Zap size={12} /> {label}
      </button>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
function PlansContent() {
  const [plans, setPlans]     = useState<StoredPlan[]>([]);
  const [tab, setTab]         = useState<'all' | 'Membership' | 'PT'>('all');
  const [editing, setEditing] = useState<StoredPlan | null>(null);
  const [creating, setCreating] = useState<'Membership' | 'PT' | null>(null);
  const [flash, setFlash]     = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLANS_KEY);
      if (raw) setPlans(JSON.parse(raw));
      else { setPlans(DEFAULT_PLANS); localStorage.setItem(PLANS_KEY, JSON.stringify(DEFAULT_PLANS)); }
    } catch { setPlans(DEFAULT_PLANS); }
  }, []);

  useEffect(() => {
    if (plans.length > 0) {
      try { localStorage.setItem(PLANS_KEY, JSON.stringify(plans)); } catch {}
    }
  }, [plans]);

  function showFlash(msg: string) {
    setFlash(msg); setTimeout(() => setFlash(''), 3000);
  }

  function deletePlan(id: string) {
    if (!confirm('Delete this plan?')) return;
    setPlans(plans.filter((p) => p.id !== id));
    showFlash('Plan deleted.');
  }

  function generateSet(kind: PlanKind) {
    const label = kind === 'PT' ? 'Personal Training' : 'Membership';
    if (!confirm(`Generate the full ${label} plan set? Existing ${label} plans will be replaced.`)) return;
    const fresh  = DEFAULT_PLANS.filter((p) => p.kind === kind);
    const others = plans.filter((p) => p.kind !== kind);
    setPlans([...others, ...fresh]);
    showFlash(`${label} plans generated.`);
  }

  function resetAll() {
    if (!confirm('Reset ALL plans to default templates?')) return;
    setPlans(DEFAULT_PLANS);
    showFlash('Plans reset to defaults.');
  }

  const visible = tab === 'all' ? plans : plans.filter((p) => p.kind === tab);
  const memCount = plans.filter((p) => p.kind === 'Membership').length;
  const ptCount  = plans.filter((p) => p.kind === 'PT').length;

  return (
    <AppShell title="Plans">
      <div className="page-container animate-fade-in">

        {/* ── Header ── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Membership Plans</h1>
            <p className="page-subtitle">{plans.length} plan{plans.length !== 1 ? 's' : ''} configured</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={resetAll}>Reset to Defaults</button>
            <button className="btn btn-primary btn-sm" onClick={() => setCreating('Membership')}>
              <Plus size={14} /> Create Plan
            </button>
          </div>
        </div>

        {/* ── Flash ── */}
        {flash && (
          <div className="alert alert-success animate-slide-up" style={{ marginBottom: 16 }}>
            <CheckCircle size={14} /> {flash}
          </div>
        )}

        {/* ── Quick-generate cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
          <ActionCard
            icon={<Package size={18} />}
            title="Gym Membership"
            desc="Monthly · Quarterly · Half · Yearly"
            count={`${memCount} plan${memCount !== 1 ? 's' : ''} configured`}
            label="Generate Membership Set"
            color="var(--brand)"
            onClick={() => generateSet('Membership')}
          />
          <ActionCard
            icon={<Star size={18} />}
            title="Personal Training"
            desc="PT packages with sessions/week"
            count={`${ptCount} plan${ptCount !== 1 ? 's' : ''} configured`}
            label="Generate PT Set"
            color="#7c3aed"
            onClick={() => generateSet('PT')}
          />
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                <Plus size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Custom Plan</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Build a unique offer</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Custom pricing & perks</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setCreating('Membership')}>
                <Plus size={12} /> Membership
              </button>
              <button className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setCreating('PT')}>
                <Plus size={12} /> PT Plan
              </button>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
            All Plans · {plans.length}
          </button>
          <button className={`tab-btn ${tab === 'Membership' ? 'active' : ''}`} onClick={() => setTab('Membership')}>
            Gym Membership · {memCount}
          </button>
          <button className={`tab-btn ${tab === 'PT' ? 'active' : ''}`} onClick={() => setTab('PT')}>
            Personal Training · {ptCount}
          </button>
        </div>

        {/* ── Plans grid ── */}
        {visible.length === 0 ? (
          <div className="empty-state">
            <Package size={36} className="empty-state-icon" />
            <p className="empty-state-title">No plans yet</p>
            <p className="empty-state-desc">Generate a default set or create a custom plan to get started.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => generateSet('Membership')}>
                <Zap size={13} /> Generate Gym Plans
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => generateSet('PT')}>
                Generate PT Plans
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {visible.map((p) => (
              <PlanCard key={p.id} plan={p} onEdit={setEditing} onDelete={deletePlan} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {(editing || creating) && (
        <PlanModal
          initial={editing ?? {
            id: `p-${Date.now()}`,
            kind: (creating || 'Membership') as PlanKind,
            name: '',
            duration: 'Monthly' as PlanDuration,
            base_amount: 0,
            discount: 0,
            final_amount: 0,
            sessions_per_week: creating === 'PT' ? 3 : undefined,
            features: [],
          }}
          onClose={() => { setEditing(null); setCreating(null); }}
          onSave={(p) => {
            if (editing) {
              setPlans(plans.map((x) => x.id === p.id ? p : x));
              showFlash('Plan updated.');
            } else {
              setPlans([...plans, p]);
              showFlash('Plan created.');
            }
            setEditing(null);
            setCreating(null);
          }}
        />
      )}
    </AppShell>
  );
}

export default function PlansPage() {
  return <Guard><PlansContent /></Guard>;
}
