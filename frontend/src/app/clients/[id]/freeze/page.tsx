'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';

export default function FreezePage() { return <Guard><Inner /></Guard>; }

function Inner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ from: '', until: '', reason: '' });

  useEffect(() => {
    api.clients.get(id).then(setClient).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.from || !form.until) {
      const m = 'From and Until dates are required';
      setError(m); toast.error(m); return;
    }
    if (new Date(form.until) <= new Date(form.from)) {
      const m = 'Until date must be after From date';
      setError(m); toast.error(m); return;
    }
    setSaving(true);
    try {
      // Backend expects freeze_from / freeze_until — map from form fields.
      const result = await api.clients.freeze(id, {
        freeze_from: form.from,
        freeze_until: form.until,
        reason: form.reason || null,
      });
      const m = result?.message || 'Membership frozen successfully!';
      setSuccess(m); toast.success(m);
      setTimeout(() => router.push(`/clients/${id}`), 900);
    } catch (err: any) {
      const m = err?.message || 'Failed to freeze membership';
      setError(m); toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><div className="page-main" style={{ padding: '2rem', color: 'var(--muted)' }}>Loading…</div></AppShell>;
  const initials = (client?.name || 'C').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <div className="page-main"><div className="ptf-wrap">
        <Link href={`/clients/${id}`} className="ptf-back-btn">← Back to Member</Link>
        {success && <div className="ptf-success">✓ {success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="ptf-client-hero">
          {client?.photo_url ? <img src={client.photo_url} alt="" className="ptf-client-avatar" /> : <div className="ptf-client-avatar-initials">{initials}</div>}
          <div><div className="ptf-client-name">{client?.name}</div><div className="ptf-client-meta">📞 {client?.mobile || '—'} • {client?.email || '—'}</div></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ptf-card">
            <div className="ptf-card-header"><span className="ptf-card-header-icon">❄️</span><span className="ptf-card-header-title">Freeze Membership</span></div>
            <div className="ptf-card-body">
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.84rem', color: '#1d4ed8', marginBottom: '.5rem' }}>
                ℹ️ Freezing will pause the membership. The remaining days will be carried forward when unfrozen.
              </div>
              <div className="ptf-row-2">
                <div className="ptf-field">
                  <label className="ptf-label">Freeze From <span className="req">*</span></label>
                  <input type="date" className="ptf-input" value={form.from} onChange={e => set('from', e.target.value)} required />
                </div>
                <div className="ptf-field">
                  <label className="ptf-label">Freeze Until <span className="req">*</span></label>
                  <input type="date" className="ptf-input" value={form.until} onChange={e => set('until', e.target.value)} required />
                </div>
              </div>
              <div className="ptf-field">
                <label className="ptf-label">Reason</label>
                <textarea className="ptf-input" rows={3} placeholder="Reason for freezing membership…" value={form.reason} onChange={e => set('reason', e.target.value)} style={{ resize: 'vertical' }} />
              </div>
              {form.from && form.until && (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '.65rem 1rem', fontSize: '.84rem', color: '#15803d' }}>
                  ✓ Freeze duration: {Math.round((new Date(form.until).getTime() - new Date(form.from).getTime()) / 86400000)} days
                </div>
              )}
            </div>
          </div>
          <div className="ptf-actions">
            <Link href={`/clients/${id}`} className="ptf-btn-secondary">Cancel</Link>
            <button type="submit" className="ptf-btn-primary" disabled={saving} style={{ background: '#3b82f6' }}>{saving ? 'Saving…' : '❄️ Freeze Membership'}</button>
          </div>
        </form>
      </div></div>
    </AppShell>
  );
}
