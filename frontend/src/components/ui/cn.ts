// frontend/src/components/ui/cn.ts
//
// Tiny re-export of clsx so design-system files don't all import the same
// thing five different ways. Keeps the surface area predictable.

import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export type { ClassValue };
