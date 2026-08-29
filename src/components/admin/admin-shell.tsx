import Link from 'next/link';
import { cn } from '@/lib/utils';

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-ink-700 pb-5">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="text-2xl leading-none sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-bone-dim">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function AdminTable({
  head,
  children,
}: {
  head: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto border border-ink-700">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-ink-700 bg-ink-800">
          <tr>
            {head.map((label) => (
              <th
                key={label}
                scope="col"
                className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-bone-dim"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700">{children}</tbody>
      </table>
    </div>
  );
}

export function AdminTabs({
  items,
  active,
}: {
  items: Array<{ label: string; href: string }>;
  active: string;
}) {
  return (
    <nav className="no-scrollbar mb-6 flex gap-2 overflow-x-auto" aria-label="Filter">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active ? 'page' : undefined}
          className={cn(
            'shrink-0 border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors',
            item.href === active
              ? 'border-gold-500 bg-gold-500 text-ink'
              : 'border-ink-600 text-bone-dim hover:border-gold-700 hover:text-bone',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
