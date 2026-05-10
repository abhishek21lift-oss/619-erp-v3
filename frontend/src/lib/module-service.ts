'use client';

import { seedRecords, type ModuleConfig, type ModuleRecord } from '@/lib/module-config';

const DEFAULT_API_BASE = 'http://localhost:5000';
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE;

type ListResponse = {
  records: ModuleRecord[];
  source: 'api' | 'local';
};

function apiBase() {
  return RAW_API_BASE.trim().replace(/\/+$/, '') || DEFAULT_API_BASE;
}

function token() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('619_token');
}

function storageKey(config: ModuleConfig) {
  return `619_module_${config.key}`;
}

function readLocal(config: ModuleConfig): ModuleRecord[] {
  if (typeof window === 'undefined') return seedRecords(config);
  try {
    const raw = localStorage.getItem(storageKey(config));
    if (raw) return JSON.parse(raw) as ModuleRecord[];
    const seeded = seedRecords(config);
    localStorage.setItem(storageKey(config), JSON.stringify(seeded));
    return seeded;
  } catch {
    return seedRecords(config);
  }
}

function writeLocal(config: ModuleConfig, records: ModuleRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(config), JSON.stringify(records));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const t = token();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export const moduleService = {
  async list(config: ModuleConfig): Promise<ListResponse> {
    try {
      const records = await request<ModuleRecord[]>(`/api/modules/${config.key}`);
      return { records, source: 'api' };
    } catch {
      return { records: readLocal(config), source: 'local' };
    }
  },

  async create(config: ModuleConfig, payload: Omit<ModuleRecord, 'id' | 'createdAt'>): Promise<ModuleRecord> {
    try {
      return await request<ModuleRecord>(`/api/modules/${config.key}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      const records = readLocal(config);
      const created: ModuleRecord = {
        ...payload,
        id: `${config.key}-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      writeLocal(config, [created, ...records]);
      return created;
    }
  },

  async update(config: ModuleConfig, id: string, patch: Partial<ModuleRecord>): Promise<ModuleRecord> {
    try {
      return await request<ModuleRecord>(`/api/modules/${config.key}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    } catch {
      const records = readLocal(config);
      const updated = records.map((record) =>
        record.id === id ? { ...record, ...patch, updatedAt: new Date().toISOString() } : record,
      );
      writeLocal(config, updated);
      const record = updated.find((item) => item.id === id);
      if (!record) throw new Error('Record not found');
      return record;
    }
  },

  async remove(config: ModuleConfig, id: string): Promise<void> {
    try {
      await request<{ message: string }>(`/api/modules/${config.key}/${id}`, { method: 'DELETE' });
    } catch {
      writeLocal(config, readLocal(config).filter((record) => record.id !== id));
    }
  },
};

