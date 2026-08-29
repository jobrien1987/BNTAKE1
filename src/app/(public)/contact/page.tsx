import type { Metadata } from 'next';
import { getSettings } from '@/server/services/settings';
import { SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Reach the Boosie Network team — support, press, partnerships and creator enquiries.',
  alternates: { canonical: '/contact' },
  openGraph: { title: 'Contact | Boosie Network', url: '/contact' },
};

export default async function ContactPage() {
  const settings = await getSettings();
  const email = settings.supportEmail;

  const routes = [
    {
      title: 'Support',
      description:
        'Orders, downloads, membership and account problems. Include your order number if you have one.',
      email,
    },
    {
      title: 'Creators',
      description:
        'Want to release music or sell merch on the network? Applications go through the creator flow rather than email.',
      href: '/creator/join',
      hrefLabel: 'Apply as a creator',
    },
    {
      title: 'Press and partnerships',
      description: 'Interviews, licensing, sync and brand work.',
      email,
    },
  ];

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-12 border-b border-ink-700 pb-8">
        <p className="eyebrow">Contact</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">GET IN TOUCH</h1>
        <p className="mt-4 max-w-2xl text-base text-bone-muted">
          Pick the right route below and you&rsquo;ll get a faster answer.
        </p>
      </header>

      <div className="grid gap-8 sm:grid-cols-3">
        {routes.map((route) => (
          <section key={route.title} className="panel flex flex-col p-6">
            <SectionHeader title={route.title} className="mb-3" />
            <p className="flex-1 text-sm leading-relaxed text-bone-dim">{route.description}</p>

            <div className="mt-6">
              {route.href ? (
                <ButtonLink href={route.href} variant="outline" className="w-full">
                  {route.hrefLabel}
                </ButtonLink>
              ) : route.email ? (
                <a
                  href={`mailto:${route.email}`}
                  className="block break-all text-sm text-gold-400 transition-colors hover:text-gold-300"
                >
                  {route.email}
                </a>
              ) : (
                <p className="text-sm text-bone-dim">
                  No contact address has been configured yet.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-16 max-w-2xl">
        <SectionHeader eyebrow="Before you write" title="Common questions" />
        <dl className="space-y-6 text-sm">
          <div>
            <dt className="text-bone">Where are my digital purchases?</dt>
            <dd className="mt-1 text-bone-dim">
              Everything you own is in your library at <code>/account/library</code>. If a purchase
              is missing, it usually means the payment is still settling — give it a minute, then
              get in touch with your order number.
            </dd>
          </div>
          <div>
            <dt className="text-bone">Does cancelling my membership remove my purchases?</dt>
            <dd className="mt-1 text-bone-dim">
              No. Membership controls access to the member library only. Anything you bought
              outright stays in your library permanently.
            </dd>
          </div>
          <div>
            <dt className="text-bone">Can I report something in the community?</dt>
            <dd className="mt-1 text-bone-dim">
              Yes — use the report control on any post or comment. Reports go straight to the
              moderation queue and are reviewed by a person.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
