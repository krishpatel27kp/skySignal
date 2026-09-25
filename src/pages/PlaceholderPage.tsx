/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Placeholder Page
   Styled coming-soon page for routes not yet built
   ═══════════════════════════════════════════════════════ */

import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="glass-card p-10 text-center max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-primary-100)] flex items-center justify-center mx-auto mb-4">
          <Construction size={28} className="text-[var(--color-primary-500)]" />
        </div>
        <h1 className="text-[20px] font-bold text-[var(--color-text-primary)] mb-2">
          {title}
        </h1>
        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
          {description || t('common.underDevelopment')}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-primary-400)] animate-pulse" />
          <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
            {t('common.comingSoon')}
          </span>
        </div>
      </div>
    </div>
  );
}
