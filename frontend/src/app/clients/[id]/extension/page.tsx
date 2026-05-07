'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { fmtDate } from '@/lib/format';

export default function ExtensionPage() { return <Guard><Inner /></Guard>; }

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ days: '7', reason: '' });

  useEffect(() => {
    api.clients.get(id).then(setClient).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    const days = parseInt(form.days);
    if (!Number.isFinite(days) || days <= 0) {
      const m = 'Days must be a positive number';
      setError(m); toast.error(m); return;
    }
    setSaving(true);
    try {
      const result = await api.clients.extension(id, { days, reason: form.reason || null });
      const m = result?.message || `Membership extended by ${days} days!`;
      setSuccess(m); toast.success(m);
      setTimeout(() => router.push(`/clients/${id}`), 900);
    } catch (err: any) {
      const m = err?.message || 'Failed to extend membership';
      setError(m); toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><div className="page-main" style={{ padding: '2rem', color: 'var(--muted)' }}>Loading…</div></AppShell>;
  const initials = (client?.name || 'C').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  // The clients table stores the membership end as `pt_end_date`. The original
  // code referenced `end_date` which is always undefined and gave "—" forever.
  const currentEnd = client?.pt_end_date || client?.end_date;
  const newEndDate = currentEnd
    ? fmtDate(new Date(new Date(currentEnd).getTime() + parseInt(form.days || '0') * 86400000))
    : '—';

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
            <div className="ptf-client-meta">📞 {client?.mobile || '—'} • Current end date: <strong>{fmtDate(currentEnd)}</strong></div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ptf-card">
            <div className="ptf-card-header"><span className="ptf-card-header-icon">📅</span><span className="ptf-card-header-title">Add Extension</span></div>
            <div className="ptf-card-body">
              <div className="ptf-field" style={{ maxWidth: 260 }}>
                <label className="ptf-label">Number of Days <span className="req">*</span></label>
                <input type="number" className="ptf-input" min="1" max="365" value={form.days} onChange={e => set('days', e.target.value)} required />
              </div>
              {form.days && parseInt(form.days) > 0 && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '.65rem 1rem', fontSize: '.84rem', color: '#15803d', flex: 1 }}>
                    ✓ New end date: <strong>{newEndDate}</strong>
                  </div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '.65rem 1rem', fontSize: '.84rem', color: '#1d4ed8', flex: 1 }}>
                    📅 Extension: +{form.days} days
                  </div>
                </div>
              )}
              <div className="ptf-field">
                <label className="ptf-label">Reason</label>
                <textarea className="ptf-input" rows={3} placeholder="Reason for extension (injury, travel, etc.)…" value={form.reason} onChange={e => set('reason', e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>
          <div className="ptf-actions">
            <Link href={`/clients/${id}`} className="ptf-btn-secondary">Cancel</Link>
            <button type="submit" className="ptf-btn-primary" disabled={saving}>{saving ? 'Saving…' : '📅 Apply Extension'}</button>
          </div>
        </form>
      </div></div>
    </AppShell>
  );
}
