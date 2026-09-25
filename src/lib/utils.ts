/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Utility Functions
   ═══════════════════════════════════════════════════════ */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind CSS classes with clsx for conditional composition */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
