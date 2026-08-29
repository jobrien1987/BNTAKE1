import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { CampaignCard, CampaignProgress } from '@/components/cards/campaign-card';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, EmptyState, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { truncate } from '@/lib/utils';
import Link from 'next/link';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Heartfelt — giving back',
  description:
    'Heartfelt is where Boosie Network gives back: community campaigns, causes and the work happening on the ground.',
  alternates: { canonical: '/heartfelt' },
  openGraph: { title: 'Heartfelt | Boosie Network', url: '/heartfelt' },
};

export default async function HeartfeltPage() {
  const [featured, active, completed] = await Promise.all([
    prisma.campaign.findFirst({
      where: { status: 'ACTIVE', featured: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.campaign.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    }),
    prisma.campaign.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
  ]);

  const others = active.filter((campaign) => campaign.id !== featured?.id);

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-12 border-b border-ink-700 pb-8">
        <p className="eyebrow">Boosie Network</p>
        <h1 className="mt-3 text-5xl leading-none sm:text-7xl">HEARTFELT</h1>
        <p className="mt-4 max-w-2xl text-base text-bone-muted">
          Giving back to the neighbourhoods that raised us. Every campaign here is run in the open —
          what it&rsquo;s for, what it costs and where it stands.
        </p>
      </header>

      {featured ? (
        <section className="mb-16">
          <Link href={`/heartfelt/${featured.slug}`} className="group block">
            <div className="grid items-center gap-8 border border-ink-700 p-6 sm:p-10 lg:grid-cols-2">
              <MediaFrame
                src={featured.heroImageUrl ?? featured.thumbnailUrl}
                alt={featured.title}
                seed={featured.title}
                ratio="video"
                priority
                className="border border-ink-600"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="gold">Featured campaign</Badge>
                  {featured.category ? <Badge>{featured.category}</Badge> : null}
                </div>
                <h2 className="mt-4 text-4xl leading-none sm:text-5xl">{featured.title}</h2>
                {featured.summary ? (
                  <p className="mt-4 text-sm leading-relaxed text-bone-muted">
                    {truncate(featured.summary, 220)}
                  </p>
                ) : null}

                {featured.goalCents > 0 ? (
                  <div className="mt-6">
                    <CampaignProgress raised={featured.raisedCents} goal={featured.goalCents} />
                    <p className="mt-2 text-xs text-bone-dim">
                      {formatCents(featured.raisedCents)} raised of{' '}
                      {formatCents(featured.goalCents)} goal
                    </p>
                  </div>
                ) : null}

                <span className="mt-6 inline-block border-b border-gold-500 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400 transition-colors group-hover:text-gold-300">
                  Read the story
                </span>
              </div>
            </div>
          </Link>
        </section>
      ) : null}

      {others.length > 0 ? (
        <section className="mb-16">
          <SectionHeader eyebrow="Open now" title="Active campaigns" />
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </section>
      ) : null}

      {completed.length > 0 ? (
        <section className="mb-16">
          <SectionHeader eyebrow="Delivered" title="Completed campaigns" />
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </section>
      ) : null}

      {active.length === 0 && completed.length === 0 ? (
        <EmptyState
          title="No campaigns running yet"
          description="When a Heartfelt campaign opens it will be listed here with its full story and progress."
          action={
            <ButtonLink href="/community" variant="outline">
              Visit the community
            </ButtonLink>
          }
        />
      ) : null}
    </div>
  );
}
