'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { LogOut, Menu, Search, ShoppingBag, User as UserIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIMARY_NAV } from '@/lib/nav';
import { SearchOverlay } from './search-overlay';

export interface HeaderUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  isStaff: boolean;
  isCreator: boolean;
}

export function HeaderShell({
  user,
  cartCount,
  announcement,
}: {
  user: HeaderUser | null;
  cartCount: number;
  announcement: { text: string; href: string } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <>
      {announcement ? (
        <Link
          href={announcement.href || '/culture'}
          className="block bg-gold-sheen py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-ink transition-opacity hover:opacity-90"
        >
          {announcement.text}
        </Link>
      ) : null}

      <header
        className={cn(
          'sticky top-0 z-50 border-b transition-colors duration-300',
          scrolled
            ? 'border-ink-600 bg-ink-900/92 backdrop-blur-xl'
            : 'border-transparent bg-gradient-to-b from-ink-900 to-ink-900/0',
        )}
      >
        <div className="container-page flex h-[68px] items-center gap-4">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="-ml-2 flex h-10 w-10 items-center justify-center text-bone lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Boosie Network home">
            <span className="font-display text-lg leading-none tracking-[-0.01em] text-bone sm:text-xl">
              BOOSIE
            </span>
            <span className="gold-text font-display text-lg leading-none tracking-[-0.01em] sm:text-xl">
              NETWORK
            </span>
          </Link>

          <nav className="ml-6 hidden flex-1 items-center gap-1 lg:flex" aria-label="Primary">
            {PRIMARY_NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors',
                    active ? 'text-gold-400' : 'text-bone-muted hover:text-bone',
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-px h-px bg-gold-500" aria-hidden />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center text-bone-muted transition-colors hover:text-gold-400"
              aria-label="Search the network"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className="flex h-10 items-center gap-2 px-2 text-bone-muted transition-colors hover:text-gold-400"
                aria-label="Account menu"
                aria-expanded={accountOpen}
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-7 w-7 rounded-full border border-ink-500 object-cover"
                  />
                ) : (
                  <UserIcon className="h-[18px] w-[18px]" />
                )}
              </button>

              {accountOpen ? (
                <div className="absolute right-0 top-12 w-60 border border-ink-600 bg-ink-800 py-2 shadow-lift">
                  {user ? (
                    <>
                      <div className="border-b border-ink-600 px-4 pb-3 pt-1">
                        <p className="truncate text-sm font-medium text-bone">{user.name}</p>
                        <p className="truncate text-xs text-bone-dim">@{user.username}</p>
                      </div>
                      <MenuLink href="/account">Account</MenuLink>
                      <MenuLink href="/account/library">Library</MenuLink>
                      <MenuLink href="/account/orders">Orders</MenuLink>
                      <MenuLink href="/account/membership">Membership</MenuLink>
                      {user.isCreator ? <MenuLink href="/creator">Creator studio</MenuLink> : null}
                      {user.isStaff ? <MenuLink href="/admin">Admin</MenuLink> : null}
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="mt-1 flex w-full items-center gap-2 border-t border-ink-600 px-4 pb-1 pt-3 text-left text-sm text-bone-muted transition-colors hover:text-bone"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <MenuLink href="/login">Sign in</MenuLink>
                      <MenuLink href="/register">Create account</MenuLink>
                      <MenuLink href="/membership">Membership</MenuLink>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            <Link
              href="/cart"
              className="relative flex h-10 w-10 items-center justify-center text-bone-muted transition-colors hover:text-gold-400"
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            >
              <ShoppingBag className="h-[18px] w-[18px]" />
              {cartCount > 0 ? (
                <span className="absolute right-1 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-ink">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile navigation sheet */}
      <div
        className={cn(
          'fixed inset-0 z-[65] lg:hidden',
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!menuOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-ink/80 backdrop-blur-sm transition-opacity duration-300',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMenuOpen(false)}
        />
        <nav
          className={cn(
            'absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-ink-900 shadow-lift transition-transform duration-300 ease-premium',
            menuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="Mobile"
        >
          <div className="flex items-center justify-between border-b border-ink-600 px-5 py-4">
            <span className="font-display text-lg">
              BOOSIE <span className="gold-text">NETWORK</span>
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="p-2 text-bone-muted"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <ul className="space-y-1">
              {PRIMARY_NAV.map((item, index) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-baseline gap-3 border-b border-ink-700 py-3"
                  >
                    <span className="w-6 text-[10px] tabular-nums text-gold-700">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1">
                      <span className="block font-display text-2xl uppercase leading-none tracking-tight text-bone transition-colors group-hover:text-gold-400">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className="mt-1 block text-xs text-bone-dim">{item.description}</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-8 grid grid-cols-2 gap-2">
              <Link
                href="/radio"
                className="border border-ink-600 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-bone-muted"
              >
                Badazz Radio
              </Link>
              <Link
                href="/membership"
                className="bg-gold-500 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-ink"
              >
                Membership
              </Link>
            </div>
          </div>

          <div className="border-t border-ink-600 px-5 py-4">
            {user ? (
              <div className="flex items-center justify-between gap-3">
                <Link href="/account" className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-bone">{user.name}</span>
                  <span className="block truncate text-xs text-bone-dim">View account</span>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-[11px] font-semibold uppercase tracking-[0.16em] text-bone-dim"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  className="border border-ink-600 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-bone"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="bg-bone px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-ink"
                >
                  Join
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-4 py-2 text-sm text-bone-muted transition-colors hover:bg-ink-700 hover:text-bone"
    >
      {children}
    </Link>
  );
}
