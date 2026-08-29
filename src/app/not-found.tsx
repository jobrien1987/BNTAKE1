import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-4 font-display text-6xl leading-none sm:text-8xl">
        OFF <span className="gold-text">THE MAP</span>
      </h1>
      <p className="mt-5 max-w-md text-sm text-bone-dim">
        That page doesn’t exist, moved, or was never published. Head back to the network.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Home</ButtonLink>
        <ButtonLink href="/culture" variant="outline">
          Read Culture
        </ButtonLink>
      </div>
      <Link href="/search" className="mt-6 text-xs uppercase tracking-[0.2em] text-bone-dim hover:text-gold-400">
        Search the network
      </Link>
    </div>
  );
}
