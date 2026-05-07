'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Guard from '@/components/Guard';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';

const SOURCES = ['Walk-in','Instagram','Facebook','Google','Referral','Banner / Hoarding','Existing Member','Other'];
const INTERESTS = ['Powerlifting','Strength Training','Personal Training','Group Class','Weight Loss','Bodybuilding','Cardio Only','Other'];

export default function AddEnquiryPage() {
  return <Guard><Inner /></Guard>;
}

function Inner() {
  const router = useRouter();
  const [form, setForm] = useState({ name:'', mobile:'', email:'', gender:'', dob:'', interested_in:'', source:'Walk-in', notes:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.name.trim() || !form.mobile.trim()) { setError('Name and mobile are required.'); return; }
    setSaving(true);
    try {
      await api.clients.create({
        name: form.name, mobile: form.mobile, email: form.email || null,
        gender: form.gender || null, dob: form.dob || null,
        interested_in: form.interested_in || null, reference_no: form.source,
        notes: form.notes || null, status: 'lead',
        joining_date: new Date().toISOString().split('T')[0],
      });
      setSuccess('Enquiry saved. They are now in your Lead Inbox.');
      setForm({ name:'', mobile:'', email:'', gender:'', dob:'', interested_in:'', source:'Walk-in', notes:'' });
      setTimeout(() => router.push('/sales/leads'), 900);
    } catch (e: any) { setError(e.message || 'Could not save enquiry.'); }
    finally { setSaving(false); }
  }

  return (
    <AppShell>
      <div className="page-main">
        <div className="page-content fade-up" style={{ maxWidth: 720 }}>
          <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 20 }}>Add New Enquiry</h2>
          {error   && <div className="alert alert-error mb-2">{error}</div>}
          {success && <div className="alert alert-success mb-2">{success}</div>}

          <form className="card" onSubmit={handleSubmit}>
            <div className="form-row form-row-2">
              <div>
                <label>Full Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Rahul Sharma" />
              </div>
              <div>
                <label>Mobile *</label>
                <input className="input" type="tel" value={form.mobile} onChange={(e) => setForm({...form, mobile: e.target.value})} placeholder="9876543210" />
              </div>
            </div>

            <div className="form-row form-row-2" style={{ marginTop: '1rem' }}>
              <div>
                <label>Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="rahul@email.com" />
              </div>
              <div>
                <label>Date of Birth</label>
                <input className="input" type="date" value={form.dob} onChange={(e) => setForm({...form, dob: e.target.value})} />
              </div>
            </div>

            <div className="form-row form-row-3" style={{ marginTop: '1rem' }}>
              <div>
                <label>Gender</label>
                <select className="input select" value={form.gender} onChange={(e) => setForm({...form, gender: e.target.value})}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label>Interested In</label>
                <select className="input select" value={form.interested_in} onChange={(e) => setForm({...form, interested_in: e.target.value})}>
                  <option value="">Select</option>
                  {INTERESTS.map((i) => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label>Lead Source</label>
                <select className="input select" value={form.source} onChange={(e) => setForm({...form, source: e.target.value})}>
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label>Notes</label>
              <textarea className="input" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})}
                placeholder="Goals, schedule, objections, anything relevant…" />
            </div>

            <div style={{ display:'flex', gap:'0.6rem', marginTop:'1.4rem', justifyContent:'flex-end' }}>
              <button type="button" onClick={() => router.back()} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Enquiry'}</button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
