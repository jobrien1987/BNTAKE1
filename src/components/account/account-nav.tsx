'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/lib/nav';

export function AccountNav({ items, unread }: { items: NavItem[]; unread: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Account sections">
      <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/account' && pathname.startsWith(`${item.href}/`));

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-between gap-2 whitespace-nowrap border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors lg:border-0 lg:border-l-2 lg:px-3',
                  active
                    ? 'border-gold-500 bg-gold-500 text-ink lg:bg-transparent lg:text-gold-300'
                    : 'border-ink-600 text-bone-dim hover:border-gold-700 hover:text-bone lg:border-ink-700',
                )}
              >
                {item.label}
                {item.href === '/account/notifications' && unread > 0 ? (
                  <span className="rounded-full bg-blood px-1.5 py-0.5 text-[10px] text-bone">
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
