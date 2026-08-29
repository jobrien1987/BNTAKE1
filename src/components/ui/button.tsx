import Link from 'next/link';
import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'gold' | 'solid' | 'outline' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold uppercase tracking-[0.14em] transition-all duration-200 ease-premium disabled:pointer-events-none disabled:opacity-40';

const variants: Record<Variant, string> = {
  gold: 'bg-gold-500 text-ink shadow-gold hover:bg-gold-400 active:translate-y-px',
  solid: 'bg-bone text-ink hover:bg-white active:translate-y-px',
  outline: 'border border-ink-500 text-bone hover:border-gold-500 hover:text-gold-300',
  ghost: 'text-bone-muted hover:bg-ink-700 hover:text-bone',
  danger: 'bg-blood text-white hover:bg-[#a10f1a]',
  quiet: 'bg-ink-700 text-bone hover:bg-ink-600',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[11px]',
  md: 'h-11 px-5 text-xs',
  lg: 'h-13 px-7 text-sm py-4',
  icon: 'h-10 w-10 p-0',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ className, variant = 'gold', size = 'md', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ className, variant = 'gold', size = 'md', ...props }: ButtonLinkProps) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function buttonClasses(variant: Variant = 'gold', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}
