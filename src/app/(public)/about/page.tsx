import type { Metadata } from 'next';
import { getSettings } from '@/server/services/settings';
import { SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { PRIMARY_NAV } from '@/lib/nav';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'About the network',
  description:
    'Boosie Network is an owned digital entertainment ecosystem — culture, music, film, live, shop, community and giving back, all under one roof.',
  alternates: { canonical: '/about' },
  openGraph: { title: 'About | Boosie Network', url: '/about' },
};

export default async function AboutPage() {
  const settings = await getSettings();

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-12 border-b border-ink-700 pb-8">
        <p className="eyebrow">About</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">THE NETWORK</h1>
        <p className="mt-4 max-w-2xl text-lg text-bone-muted">{settings.tagline}</p>
      </header>

      <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="prose-editorial max-w-2xl">
          <p>
            {settings.siteName} is an owned platform. Not a page on someone else&rsquo;s app, not a
            channel that can be switched off — a place where the work, the audience and the
            relationship between them belong to the people who built them.
          </p>

          <p>
            That ownership is the point. Artists keep their catalogue on a page they control.
            Members buy things that stay bought. Stories are published by a newsroom rather than
            surfaced by a recommendation engine. Nothing here is rented.
          </p>

          <h2>How it fits together</h2>
          <p>
            The network is organised as seven pillars. Each one stands on its own, and they feed
            each other: a story in Culture links the track it&rsquo;s about, the track links the
            album you can own, the album links the tour merch, and the whole thing runs through one
            account and one cart.
          </p>

          <h2>What you own</h2>
          <p>
            Anything you buy outright — a track, an album, a film, a digital release — lands in your
            library and stays there. Membership adds access to the member library on top of that,
            but cancelling a membership never takes away something you purchased. Those are two
            different things and we keep them that way on purpose.
          </p>

          <h2>Money, plainly</h2>
          <p>
            Prices are in real currency. There are no tokens, no coins, no credits and no internal
            wallet to top up. You pay for a thing, you get the thing.
          </p>
        </div>

        <aside className="space-y-10">
          <div>
            <SectionHeader eyebrow="Explore" title="Seven pillars" className="mb-4" />
            <ul className="space-y-3">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="group block border-b border-ink-700 pb-3 transition-colors"
                  >
                    <span className="block font-display text-lg uppercase tracking-tight text-bone transition-colors group-hover:text-gold-300">
                      {item.label}
                    </span>
                    {item.description ? (
                      <span className="block text-xs text-bone-dim">{item.description}</span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-6">
            <h2 className="eyebrow mb-3">Get in touch</h2>
            <p className="text-sm text-bone-dim">
              Press, partnerships, licensing or support — start here.
            </p>
            <div className="mt-5">
              <ButtonLink href="/contact" className="w-full">
                Contact us
              </ButtonLink>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
