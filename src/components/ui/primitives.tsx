import Link from 'next/link';
import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'gold' | 'live' | 'success' | 'warn' | 'danger';
  className?: string;
}) {
  const tones = {
    neutral: 'border-ink-500 bg-ink-700 text-bone-muted',
    gold: 'border-gold-600/60 bg-gold-500/10 text-gold-300',
    live: 'border-blood/60 bg-blood/15 text-[#ff8a92]',
    success: 'border-jade/50 bg-jade/10 text-[#5fdca8]',
    warn: 'border-gold-700 bg-gold-900/40 text-gold-300',
    danger: 'border-blood/60 bg-blood/10 text-[#ff8a92]',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blood opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blood" />
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  hrefLabel = 'View all',
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-6', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="text-2xl leading-none sm:text-3xl lg:text-4xl">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-bone-dim">{description}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="hidden shrink-0 border-b border-gold-700/60 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400 transition-colors hover:border-gold-400 hover:text-gold-300 sm:inline-block"
        >
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'panel flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold-700/50 bg-gold-500/5 text-gold-500">
        {icon ?? <span className="font-display text-lg">BN</span>}
      </div>
      <h3 className="text-lg tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-bone-dim">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-sm', className)} />;
}

export function CardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[2/3] w-full" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function RailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="rail">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="w-[170px] space-y-3 sm:w-[210px]">
          <Skeleton className="aspect-[2/3] w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-ink-600', className)} />;
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bone-dim">{label}</p>
      <p className="mt-2 font-display text-3xl leading-none tracking-tight text-bone">{value}</p>
      {hint ? <p className="mt-1 text-xs text-bone-dim">{hint}</p> : null}
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'error' | 'success' | 'warn';
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    info: 'border-ink-500 bg-ink-800 text-bone-muted',
    error: 'border-blood/50 bg-blood/10 text-[#ffb3b8]',
    success: 'border-jade/40 bg-jade/10 text-[#8ff0c4]',
    warn: 'border-gold-700 bg-gold-900/30 text-gold-200',
  } as const;
  return (
    <div className={cn('rounded-sm border px-4 py-3 text-sm', tones[tone])} role="status">
      {title ? <p className="mb-1 font-semibold uppercase tracking-wide">{title}</p> : null}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-bone-dim">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-gold-400">
                {item.label}
              </Link>
            ) : (
              <span className="text-bone-muted">{item.label}</span>
            )}
            {index < items.length - 1 ? <span aria-hidden className="text-ink-400">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
