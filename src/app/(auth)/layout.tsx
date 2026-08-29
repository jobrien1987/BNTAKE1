import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(212,175,55,0.16) 0%, rgba(7,7,10,0) 70%)',
        }}
      />
      <header className="relative z-10 border-b border-ink-700">
        <div className="container-page flex h-[68px] items-center justify-between">
          <Link href="/" className="font-display text-lg tracking-tight">
            BOOSIE <span className="gold-text">NETWORK</span>
          </Link>
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-bone-dim hover:text-bone"
          >
            Back to site
          </Link>
        </div>
      </header>
      <main id="main" className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
