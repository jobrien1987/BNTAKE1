'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface AdminNavGroupView {
  label: string;
  items: Array<{ label: string; href: string }>;
}

export function AdminNav({ groups }: { groups: AdminNavGroupView[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="shrink-0 border-b border-ink-700 lg:w-56 lg:border-b-0 lg:border-r"
    >
      <div className="no-scrollbar flex gap-6 overflow-x-auto px-4 py-4 lg:flex-col lg:px-4 lg:py-6">
        {groups.map((group) => (
          <div key={group.label} className="shrink-0">
            <p className="mb-2 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-bone-dim lg:block">
              {group.label}
            </p>
            <ul className="flex gap-2 lg:flex-col lg:gap-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));

                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'block whitespace-nowrap rounded-sm px-3 py-2 text-xs transition-colors',
                        active
                          ? 'bg-gold-500/10 text-gold-300'
                          : 'text-bone-dim hover:bg-ink-800 hover:text-bone',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
