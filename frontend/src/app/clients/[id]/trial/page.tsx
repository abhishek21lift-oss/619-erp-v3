'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';

export default function TrialPage() { return <Guard><Inner /></Guard>; }

const TIME_SLOTS = ['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'];

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
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, time_slot: '', trainer_id: '', focus_area: '', notes: '' });

  useEffect(() => {
    Promise.all([api.clients.get(id), api.trainers.list().catch(() => [])])
      .then(([c, t]) => { setClient(c); setTrainers(Array.isArray(t) ? t : []); })
      .catch(console.error).finally(() => setLoading(false));
  }, [id]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.date) { const m = 'Trial date is required'; setError(m); toast.error(m); return; }
    setSaving(true);
    try {
      const result = await api.clients.trial(id, {
        trial_date: form.date,
        time_slot: form.time_slot || null,
        trainer_id: form.trainer_id || null,
        focus_area: form.focus_area || null,
        notes: form.notes || null,
      });
      const m = result?.message || 'Free trial session booked!';
      setSuccess(m); toast.success(m);
      setTimeout(() => router.push(`/clients/${id}`), 900);
    } catch (err: any) {
      const m = err?.message || 'Failed to book trial';
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
          <div><div className="ptf-client-name">{client?.name}</div><div className="ptf-client-meta">📞 {client?.mobile || '—'} • {client?.email || '—'}</div></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ptf-card">
            <div className="ptf-card-header"><span className="ptf-card-header-icon">🎯</span><span className="ptf-card-header-title">Book a Free Trial Session</span></div>
            <div className="ptf-card-body">
              <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '.75rem 1rem', fontSize: '.84rem', color: '#065f46', marginBottom: '.5rem' }}>
                🎯 Book a complimentary trial session for this member. No charge applies.
              </div>
              <div className="ptf-row-2">
                <div className="ptf-field">
                  <label className="ptf-label">Trial Date <span className="req">*</span></label>
                  <input type="date" className="ptf-input" value={form.date} onChange={e => set('date', e.target.value)} required min={today} />
                </div>
                <div className="ptf-field">
                  <label className="ptf-label">Time Slot</label>
                  <select className="ptf-select" value={form.time_slot} onChange={e => set('time_slot', e.target.value)}>
                    <option value="">Select Time</option>
                    {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="ptf-row-2">
                <div className="ptf-field">
                  <label className="ptf-label">Assign Trainer</label>
                  <select className="ptf-select" value={form.trainer_id} onChange={e => set('trainer_id', e.target.value)}>
                    <option value="">Any Available Trainer</option>
                    {trainers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="ptf-field">
                  <label className="ptf-label">Focus Area</label>
                  <select className="ptf-select" value={form.focus_area} onChange={e => set('focus_area', e.target.value)}>
                    <option value="">General Fitness</option>
                    <option>Weight Loss</option>
                    <option>Muscle Gain</option>
                    <option>Strength Training</option>
                    <option>Cardio</option>
                    <option>Flexibility</option>
                    <option>Rehabilitation</option>
                  </select>
                </div>
              </div>
              <div className="ptf-field">
                <label className="ptf-label">Notes / Special Requirements</label>
                <textarea className="ptf-input" rows={3} placeholder="Any health conditions, goals, or special requirements…" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>
          <div className="ptf-actions">
            <Link href={`/clients/${id}`} className="ptf-btn-secondary">Cancel</Link>
            <button type="submit" className="ptf-btn-primary" disabled={saving} style={{ background: '#059669' }}>{saving ? 'Booking…' : '🎯 Book Free Trial'}</button>
          </div>
        </form>
      </div></div>
    </AppShell>
  );
}
