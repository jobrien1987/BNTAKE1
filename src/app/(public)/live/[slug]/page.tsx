import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { flags } from '@/lib/env';
import { getCurrentUser } from '@/server/auth/session';
import { evaluateAccess } from '@/server/services/entitlements';
import { LiveStreamPlayer } from '@/components/live/live-stream-player';
import { AccessGate } from '@/components/commerce/access-gate';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, Breadcrumbs, LiveDot } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatDateTime, truncate } from '@/lib/utils';

export const revalidate = 15;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const stream = await prisma.liveStream.findUnique({
    where: { slug },
    select: { title: true, description: true, posterUrl: true },
  });

  if (!stream) return { title: 'Stream not found', robots: { index: false, follow: false } };

  const description = stream.description
    ? truncate(stream.description, 155)
    : `${stream.title} — live on Boosie Network.`;

  return {
    title: stream.title,
    description,
    alternates: { canonical: `/live/${slug}` },
    openGraph: {
      title: stream.title,
      description,
      url: `/live/${slug}`,
      images: stream.posterUrl ? [stream.posterUrl] : undefined,
    },
  };
}

export default async function LiveDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();

  const stream = await prisma.liveStream.findUnique({
    where: { slug },
    include: {
      artist: { select: { stageName: true, slug: true, profileImageUrl: true } },
      replayVideo: { select: { slug: true, title: true, posterUrl: true } },
    },
  });

  if (!stream) notFound();

  // Live streams are gated by the same access model as everything else. There
  // is no entitlement kind for a stream, so a paid stream is checked against
  // its replay video when one exists, and otherwise against membership.
  const decision = await evaluateAccess({
    accessType: stream.accessType,
    kind: 'VIDEO',
    refId: stream.replayVideoId ?? stream.id,
    userId: user?.id ?? null,
    role: user?.role ?? null,
    published: true,
  });

  const isLive = stream.status === 'LIVE';
  const canPlay = decision.allowed && isLive && flags.liveEnabled && Boolean(stream.playbackUrl);

  return (
    <div className="container-page py-10 sm:py-14">
      <Breadcrumbs items={[{ label: 'Live', href: '/live' }, { label: stream.title }]} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {canPlay ? (
            <LiveStreamPlayer
              playbackUrl={stream.playbackUrl!}
              title={stream.title}
              posterUrl={stream.posterUrl}
            />
          ) : (
            <MediaFrame
              src={stream.posterUrl}
              alt={stream.title}
              seed={stream.title}
              ratio="video"
              overlay
              priority
              className="border border-ink-600"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="px-6 text-center">
                  {isLive && !flags.liveEnabled ? (
                    <p className="text-sm text-bone-muted">
                      Live playback is switched off for this deployment.
                    </p>
                  ) : isLive && !stream.playbackUrl ? (
                    <p className="text-sm text-bone-muted">
                      This stream is on air but no playback URL has been attached yet.
                    </p>
                  ) : stream.status === 'SCHEDULED' ? (
                    <p className="text-sm text-bone-muted">
                      {stream.scheduledFor
                        ? `Starts ${formatDateTime(stream.scheduledFor)}`
                        : 'Date to be announced'}
                    </p>
                  ) : (
                    <p className="text-sm text-bone-muted">This stream has ended.</p>
                  )}
                </div>
              </div>
            </MediaFrame>
          )}

          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-2">
              {isLive ? (
                <span className="inline-flex items-center gap-2 rounded-sm border border-blood/60 bg-blood/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ff8a92]">
                  <LiveDot /> Live
                </span>
              ) : (
                <Badge>{stream.status}</Badge>
              )}
              {stream.accessType === 'MEMBERSHIP' ? <Badge tone="gold">Members</Badge> : null}
            </div>

            <h1 className="mt-4 text-4xl leading-[0.92] sm:text-6xl">{stream.title}</h1>

            {stream.artist ? (
              <Link
                href={`/artists/${stream.artist.slug}`}
                className="mt-3 inline-block text-lg text-bone-muted transition-colors hover:text-gold-300"
              >
                {stream.artist.stageName}
              </Link>
            ) : null}

            {stream.description ? (
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-bone-muted">
                {stream.description}
              </p>
            ) : null}
          </div>

          {!decision.allowed ? (
            <div className="mt-8">
              <AccessGate
                reason={decision.reason}
                kind="VIDEO"
                refId={stream.replayVideoId ?? stream.id}
                priceCents={stream.priceCents}
                purchasable={Boolean(stream.priceCents)}
                title={stream.title}
                returnTo={`/live/${slug}`}
              />
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="panel p-5">
            <h2 className="eyebrow mb-3">Details</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-bone-dim">Status</dt>
                <dd className="text-bone">{stream.status}</dd>
              </div>
              {stream.scheduledFor ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-bone-dim">Scheduled</dt>
                  <dd className="text-bone">{formatDateTime(stream.scheduledFor)}</dd>
                </div>
              ) : null}
              {stream.startedAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-bone-dim">Started</dt>
                  <dd className="text-bone">{formatDateTime(stream.startedAt)}</dd>
                </div>
              ) : null}
              {stream.endedAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-bone-dim">Ended</dt>
                  <dd className="text-bone">{formatDateTime(stream.endedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {stream.replayVideo ? (
            <div className="panel p-5">
              <h2 className="eyebrow mb-3">Replay available</h2>
              <Link href={`/watch/${stream.replayVideo.slug}`} className="group block">
                <MediaFrame
                  src={stream.replayVideo.posterUrl}
                  alt={stream.replayVideo.title}
                  seed={stream.replayVideo.title}
                  ratio="video"
                  className="mb-3 border border-ink-600"
                />
                <span className="text-sm text-bone transition-colors group-hover:text-gold-300">
                  {stream.replayVideo.title}
                </span>
              </Link>
            </div>
          ) : null}

          <ButtonLink href="/live" variant="outline" className="w-full">
            All live streams
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}
