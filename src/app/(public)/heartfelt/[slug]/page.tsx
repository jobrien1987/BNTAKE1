import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CampaignProgress } from '@/components/cards/campaign-card';
import { DonateForm } from '@/components/heartfelt/donate-form';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, Breadcrumbs, SectionHeader, Stat } from '@/components/ui/primitives';
import { paymentsEnabled } from '@/server/services/payments';
import { sanitizeRichText } from '@/server/services/sanitize';
import { formatCents } from '@/lib/money';
import { formatDate, truncate } from '@/lib/utils';
import { appUrl } from '@/lib/env';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    select: { title: true, summary: true, heroImageUrl: true, status: true },
  });

  if (!campaign || campaign.status === 'DRAFT') {
    return { title: 'Campaign not found', robots: { index: false, follow: false } };
  }

  const description = campaign.summary
    ? truncate(campaign.summary, 155)
    : `${campaign.title} — a Heartfelt campaign on Boosie Network.`;

  return {
    title: campaign.title,
    description,
    alternates: { canonical: `/heartfelt/${slug}` },
    openGraph: {
      title: campaign.title,
      description,
      url: `/heartfelt/${slug}`,
      images: campaign.heroImageUrl ? [campaign.heroImageUrl] : undefined,
    },
  };
}

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: {
      updates: { orderBy: { createdAt: 'desc' } },
      _count: { select: { donations: true } },
    },
  });

  if (!campaign || campaign.status === 'DRAFT') notFound();

  const canDonate =
    campaign.donationEnabled && campaign.status === 'ACTIVE' && paymentsEnabled();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: campaign.title,
    description: campaign.summary ?? undefined,
    image: campaign.heroImageUrl ?? undefined,
    datePublished: campaign.createdAt.toISOString(),
    url: `${appUrl.replace(/\/+$/, '')}/heartfelt/${slug}`,
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <Breadcrumbs items={[{ label: 'Heartfelt', href: '/heartfelt' }, { label: campaign.title }]} />

      <MediaFrame
        src={campaign.heroImageUrl ?? campaign.thumbnailUrl}
        alt={campaign.title}
        seed={campaign.title}
        ratio="wide"
        priority
        overlay
        className="border border-ink-600"
      />

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {campaign.status}
            </Badge>
            {campaign.category ? <Badge>{campaign.category}</Badge> : null}
            {campaign.location ? <Badge>{campaign.location}</Badge> : null}
          </div>

          <h1 className="mt-4 text-4xl leading-[0.92] sm:text-6xl">{campaign.title}</h1>

          {campaign.summary ? (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-bone-muted">
              {campaign.summary}
            </p>
          ) : null}

          <div
            className="prose-editorial mt-10"
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(campaign.story) }}
          />

          {campaign.updates.length > 0 ? (
            <section className="mt-16">
              <SectionHeader eyebrow="Progress" title="Campaign updates" />
              <div className="space-y-8">
                {campaign.updates.map((update) => (
                  <article key={update.id} className="border-l-2 border-gold-700/50 pl-5">
                    <time
                      dateTime={update.createdAt.toISOString()}
                      className="text-xs uppercase tracking-[0.16em] text-bone-dim"
                    >
                      {formatDate(update.createdAt)}
                    </time>
                    <h3 className="mt-2 font-display text-xl uppercase tracking-tight text-bone">
                      {update.title}
                    </h3>
                    {update.imageUrl ? (
                      <MediaFrame
                        src={update.imageUrl}
                        alt={update.title}
                        seed={update.title}
                        ratio="video"
                        className="mt-4 border border-ink-600"
                      />
                    ) : null}
                    <div
                      className="prose-editorial mt-3"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(update.body) }}
                    />
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="panel p-6">
            {campaign.goalCents > 0 ? (
              <>
                <p className="font-display text-4xl text-gold-400">
                  {formatCents(campaign.raisedCents)}
                </p>
                <p className="mt-1 text-sm text-bone-dim">
                  raised of {formatCents(campaign.goalCents)} goal
                </p>
                <div className="mt-4">
                  <CampaignProgress raised={campaign.raisedCents} goal={campaign.goalCents} />
                </div>
              </>
            ) : (
              <p className="text-sm text-bone-muted">
                This campaign is about awareness and action rather than a fundraising target.
              </p>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Stat label="Supporters" value={String(campaign._count.donations)} />
              <Stat
                label="Status"
                value={campaign.status === 'ACTIVE' ? 'Open' : 'Closed'}
              />
            </div>

            {campaign.endsAt ? (
              <p className="mt-4 text-xs text-bone-dim">
                Closes {formatDate(campaign.endsAt)}
              </p>
            ) : null}
          </div>

          {canDonate ? (
            <DonateForm campaignId={campaign.id} campaignTitle={campaign.title} />
          ) : campaign.donationEnabled && campaign.status === 'ACTIVE' ? (
            <div className="panel p-6">
              <p className="text-sm text-bone-muted">
                Donations are temporarily unavailable because payments have not been configured for
                this deployment.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
