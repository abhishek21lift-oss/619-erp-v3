'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';

export default function TransferPage() { return <Guard><Inner /></Guard>; }

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
  const [form, setForm] = useState({ trainer_id: '', reason: '' });

  useEffect(() => {
    Promise.all([api.clients.get(id), api.trainers.list().catch(() => [])])
      .then(([c, t]) => { setClient(c); setTrainers(Array.isArray(t) ? t : []); })
      .catch(console.error).finally(() => setLoading(false));
  }, [id]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.trainer_id) { const m = 'Pick a new trainer'; setError(m); toast.error(m); return; }
    setSaving(true);
    try {
      const result = await api.clients.transfer(id, {
        new_trainer_id: form.trainer_id,
        reason: form.reason || null,
      });
      const newTrainer = trainers.find(t => t.id === form.trainer_id);
      const m = result?.message || `Member transferred to ${newTrainer?.name || 'new trainer'}!`;
      setSuccess(m); toast.success(m);
      setTimeout(() => router.push(`/clients/${id}`), 900);
    } catch (err: any) {
      const m = err?.message || 'Failed to transfer member';
      setError(m); toast.error(m);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppShell><div className="page-main" style={{ padding: '2rem' }}>Loading…</div></AppShell>;
  const initials = (client?.name || 'C').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const currentTrainer = trainers.find(t => t.id === client?.trainer_id);
  const newTrainer = trainers.find(t => t.id === form.trainer_id);

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
            <div className="ptf-client-meta">Current trainer: <strong>{currentTrainer?.name || client?.trainer_name || '—'}</strong></div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ptf-card">
            <div className="ptf-card-header"><span className="ptf-card-header-icon">🔀</span><span className="ptf-card-header-title">Transfer Member to New Trainer</span></div>
            <div className="ptf-card-body">
              <div className="ptf-field">
                <label className="ptf-label">Transfer To Trainer <span className="req">*</span></label>
                <select className="ptf-select" value={form.trainer_id} onChange={e => set('trainer_id', e.target.value)} required>
                  <option value="">Select Trainer</option>
                  {trainers.filter(t => t.id !== client?.trainer_id).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}{t.role ? ` — ${t.role}` : ''}</option>
                  ))}
                </select>
              </div>
              {form.trainer_id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '.65rem 1rem', fontSize: '.84rem', color: '#15803d' }}>
                  <span>🔀</span>
                  <span><strong>{currentTrainer?.name || '—'}</strong> → <strong>{newTrainer?.name}</strong></span>
                </div>
              )}
              <div className="ptf-field">
                <label className="ptf-label">Reason</label>
                <textarea className="ptf-input" rows={3} placeholder="Reason for transfer…" value={form.reason} onChange={e => set('reason', e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>
          <div className="ptf-actions">
            <Link href={`/clients/${id}`} className="ptf-btn-secondary">Cancel</Link>
            <button type="submit" className="ptf-btn-primary" disabled={saving} style={{ background: '#8b5cf6' }}>{saving ? 'Saving…' : '🔀 Transfer Member'}</button>
          </div>
        </form>
      </div></div>
    </AppShell>
  );
}
