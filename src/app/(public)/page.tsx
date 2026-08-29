import Link from 'next/link';
import { ArrowRight, Radio as RadioIcon } from 'lucide-react';
import { getHomepage } from '@/server/queries/homepage';
import { MediaFrame } from '@/components/ui/media-frame';
import { Badge, EmptyState, LiveDot, SectionHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { ArticleCard } from '@/components/cards/article-card';
import { VideoCard } from '@/components/cards/video-card';
import { AlbumCard, ArtistCard, SongRow } from '@/components/cards/music-cards';
import { ProductCard } from '@/components/cards/product-card';
import { CampaignProgress } from '@/components/cards/campaign-card';
import { RadioPlayButton } from '@/components/listen/radio-play-button';
import { formatCents } from '@/lib/money';
import { relativeTime } from '@/lib/utils';

export const revalidate = 60;

export default async function HomePage() {
  const data = await getHomepage();
  const { hero } = data;

  const lead = data.breakingArticles[0] ?? data.latestArticles[0] ?? null;
  const secondary = data.latestArticles.filter((article) => article.slug !== lead?.slug).slice(0, 4);
  const moreCulture = data.latestArticles
    .filter((article) => article.slug !== lead?.slug)
    .slice(4, 8);

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative isolate">
        <MediaFrame
          src={hero.imageUrl}
          alt={hero.headline}
          seed={hero.headline}
          ratio="auto"
          className="absolute inset-0 h-full w-full"
          priority
        />
        {hero.videoUrl ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={hero.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            poster={hero.imageUrl ?? undefined}
          />
        ) : null}
        <div className="absolute inset-0 bg-ink-fade" aria-hidden />
        <div className="absolute inset-0 hidden bg-ink-side lg:block" aria-hidden />

        <div className="container-page relative flex min-h-[72vh] flex-col justify-end py-16 sm:min-h-[80vh] lg:min-h-[86vh]">
          <div className="max-w-3xl animate-fade-up">
            <p className="eyebrow">{hero.eyebrow}</p>
            <h1 className="mt-4 text-balance font-display text-5xl leading-[0.9] tracking-tight sm:text-7xl lg:text-8xl">
              {hero.headline}
            </h1>
            {hero.subheadline ? (
              <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-bone-muted sm:text-lg">
                {hero.subheadline}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={hero.ctaHref} size="lg">
                {hero.ctaLabel}
              </ButtonLink>
              {hero.secondaryCtaLabel && hero.secondaryCtaHref ? (
                <ButtonLink href={hero.secondaryCtaHref} variant="outline" size="lg">
                  {hero.secondaryCtaLabel}
                </ButtonLink>
              ) : null}
            </div>
          </div>

          {data.liveStreams.some((stream) => stream.status === 'LIVE') ? (
            <Link
              href="/live"
              className="mt-10 inline-flex w-fit items-center gap-3 border border-blood/50 bg-blood/10 px-4 py-2.5 text-xs uppercase tracking-[0.16em] text-bone"
            >
              <LiveDot /> Live now — {data.liveStreams.find((s) => s.status === 'LIVE')?.title}
            </Link>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------------- CULTURE */}
      <section className="container-page py-16 sm:py-20">
        <SectionHeader
          eyebrow="Culture"
          title="Breaking & Trending"
          description="Hip-hop, entertainment and cultural reporting from the Boosie Network newsroom."
          href="/culture"
        />

        {lead ? (
          <div className="grid gap-10 lg:grid-cols-[1.55fr_1fr]">
            <ArticleCard
              variant="lead"
              article={{
                ...lead,
                categoryName: lead.category?.name ?? null,
                authorName: lead.author?.name ?? null,
              }}
            />
            <div className="lg:border-l lg:border-ink-700 lg:pl-8">
              {secondary.map((article) => (
                <ArticleCard
                  key={article.id}
                  variant="row"
                  article={{
                    ...article,
                    categoryName: article.category?.name ?? null,
                  }}
                />
              ))}
              {secondary.length === 0 ? (
                <p className="text-sm text-bone-dim">More stories land here as they publish.</p>
              ) : null}
            </div>
          </div>
        ) : (
          <EmptyState
            title="The newsroom is warming up"
            description="Published Culture stories will appear here. Add your first article from Admin → Culture."
            action={<ButtonLink href="/admin/culture">Open Culture CMS</ButtonLink>}
          />
        )}

        {moreCulture.length > 0 ? (
          <div className="mt-12 grid gap-8 border-t border-ink-700 pt-10 sm:grid-cols-2 lg:grid-cols-4">
            {moreCulture.map((article) => (
              <ArticleCard
                key={article.id}
                article={{ ...article, categoryName: article.category?.name ?? null }}
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* --------------------------------------------------------------- WATCH */}
      <section className="border-y border-ink-700 bg-ink-900 py-16 sm:py-20">
        <div className="container-page">
          <SectionHeader
            eyebrow="Watch"
            title="Watch Now"
            description="Movies, documentaries, interviews and exclusives."
            href="/watch"
          />
          {data.videos.length > 0 ? (
            <div className="rail -mx-4 px-4 sm:mx-0 sm:px-0">
              {data.videos.map((video) => (
                <VideoCard
                  key={video.id}
                  className="w-[168px] sm:w-[208px]"
                  video={{
                    slug: video.slug,
                    title: video.title,
                    posterUrl: video.posterUrl,
                    backdropUrl: video.backdropUrl,
                    kind: video.kind,
                    durationSec: video.durationSec,
                    releaseDate: video.releaseDate,
                    accessType: video.accessType,
                    priceCents: video.priceCents,
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No titles published yet"
              description="Movies and video added in Admin → Watch will stream here."
            />
          )}
        </div>
      </section>

      {/* -------------------------------------------------------------- LISTEN */}
      <section className="container-page py-16 sm:py-20">
        <SectionHeader
          eyebrow="Listen"
          title="New Music"
          description="Albums, singles and releases from the network."
          href="/listen"
        />
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {data.albums.length > 0 ? (
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                {data.albums.slice(0, 8).map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={{
                      slug: album.slug,
                      title: album.title,
                      artworkUrl: album.artworkUrl,
                      artistName: album.artist.stageName,
                      artistSlug: album.artist.slug,
                      releaseDate: album.releaseDate,
                      priceCents: album.priceCents,
                      purchasable: album.purchasable,
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="No albums yet" description="Publish music in Admin → Music." />
            )}
          </div>

          <div>
            <p className="eyebrow mb-4">Featured tracks</p>
            {data.songs.length > 0 ? (
              <div className="panel px-1 py-1">
                {data.songs.map((song, index) => (
                  <SongRow
                    key={song.id}
                    index={index}
                    song={{
                      id: song.id,
                      slug: song.slug,
                      title: song.title,
                      artworkUrl: song.artworkUrl,
                      artistName: song.artist.stageName,
                      artistSlug: song.artist.slug,
                      durationSec: song.durationSec,
                      explicit: song.explicit,
                      priceCents: song.priceCents,
                      purchasable: song.purchasable,
                      accessType: song.accessType,
                    }}
                    queue={data.songs.map((item) => ({
                      id: item.id,
                      slug: item.slug,
                      title: item.title,
                      artworkUrl: item.artworkUrl,
                      artistName: item.artist.stageName,
                      artistSlug: item.artist.slug,
                      durationSec: item.durationSec,
                    }))}
                    showArtwork={false}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="No songs yet" description="Upload singles in Admin → Music." />
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- BADAZZ RADIO */}
      {data.radioStation ? (
        <section className="border-y border-ink-700 bg-gradient-to-br from-[#140f04] via-ink-900 to-ink py-16">
          <div className="container-page grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="eyebrow flex items-center gap-2">
                <RadioIcon className="h-3.5 w-3.5" /> Badazz Radio
              </p>
              <h2 className="mt-4 text-4xl leading-none sm:text-6xl">
                {data.radioStation.name}
              </h2>
              {data.radioStation.tagline ? (
                <p className="mt-4 max-w-md text-base text-bone-muted">{data.radioStation.tagline}</p>
              ) : null}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <RadioPlayButton
                  station={{
                    id: data.radioStation.id,
                    name: data.radioStation.name,
                    streamUrl: data.radioStation.streamUrl,
                    logoUrl: data.radioStation.logoUrl,
                  }}
                />
                <ButtonLink href="/radio" variant="outline">
                  Station page
                </ButtonLink>
              </div>
            </div>

            <div className="panel p-6">
              <p className="eyebrow mb-4">Recently played</p>
              {data.radioStation.plays.length > 0 ? (
                <ul className="divide-y divide-ink-700">
                  {data.radioStation.plays.map((play) => (
                    <li key={play.id} className="flex items-center gap-3 py-3">
                      <MediaFrame
                        src={play.artworkUrl}
                        alt={play.trackTitle}
                        seed={play.trackTitle}
                        ratio="square"
                        className="h-10 w-10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-bone">{play.trackTitle}</p>
                        <p className="truncate text-xs text-bone-dim">{play.artistName}</p>
                      </div>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-bone-dim">
                        {relativeTime(play.playedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-bone-dim">
                  Programming metadata appears here once tracks are logged in Admin → Radio.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- SHOP */}
      <section className="container-page py-16 sm:py-20">
        <SectionHeader
          eyebrow="Shop"
          title="Shop The Network"
          description="Merch, limited drops and digital goods."
          href="/shop"
        />
        {data.products.length > 0 ? (
          <div className="rail -mx-4 px-4 sm:mx-0 sm:px-0">
            {data.products.map((product) => (
              <ProductCard
                key={product.id}
                className="w-[168px] sm:w-[220px]"
                product={{
                  slug: product.slug,
                  title: product.title,
                  priceCents: product.priceCents,
                  salePriceCents: product.salePriceCents,
                  imageUrl: product.images[0]?.url ?? null,
                  inventory: product.inventory,
                  trackInventory: product.trackInventory,
                  isDigital: product.isDigital,
                  categoryName: product.category?.name ?? null,
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="The store is being stocked"
            description="Products created in Admin → Products appear here instantly."
          />
        )}
      </section>

      {/* ------------------------------------------------------ ARTIST SPOTLIGHT */}
      {data.artists.length > 0 ? (
        <section className="border-y border-ink-700 bg-ink-900 py-16 sm:py-20">
          <div className="container-page">
            <SectionHeader
              eyebrow="Artists"
              title="Artist Spotlight"
              description="Independent artists building on the network."
              href="/listen#artists"
            />
            <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 lg:grid-cols-6">
              {data.artists.slice(0, 6).map((artist) => (
                <ArtistCard
                  key={artist.id}
                  artist={{
                    slug: artist.slug,
                    stageName: artist.stageName,
                    profileImageUrl: artist.profileImageUrl,
                    location: artist.location,
                    verified: artist.verified,
                  }}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------------- COMMUNITY */}
      <section className="container-page py-16 sm:py-20">
        <SectionHeader
          eyebrow="Community"
          title="From The Feed"
          description="What the network is talking about right now."
          href="/community"
        />
        {data.communityPosts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.communityPosts.map((post) => (
              <Link
                key={post.id}
                href={`/community/post/${post.id}`}
                className="panel panel-hover p-5"
              >
                <div className="flex items-center gap-3">
                  <MediaFrame
                    src={post.author.avatarUrl}
                    alt={post.author.name}
                    seed={post.author.name}
                    ratio="square"
                    className="h-9 w-9 rounded-full"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-bone">{post.author.name}</p>
                    <p className="truncate text-xs text-bone-dim">
                      @{post.author.username} · {relativeTime(post.createdAt)}
                    </p>
                  </div>
                </div>
                <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-bone-muted">{post.body}</p>
                <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-bone-dim">
                  {post.likeCount} likes · {post.commentCount} comments
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="The feed is quiet"
            description="Sign in and post the first thing on the network."
            action={<ButtonLink href="/community">Open the feed</ButtonLink>}
          />
        )}
      </section>

      {/* ----------------------------------------------------------- HEARTFELT */}
      {data.campaign ? (
        <section className="relative isolate border-y border-ink-700">
          <MediaFrame
            src={data.campaign.heroImageUrl}
            alt={data.campaign.title}
            seed={data.campaign.title}
            ratio="auto"
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute inset-0 bg-ink/85" aria-hidden />
          <div className="container-page relative grid gap-10 py-20 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Heartfelt</p>
              <h2 className="mt-4 text-4xl leading-none sm:text-6xl">{data.campaign.title}</h2>
              {data.campaign.summary ? (
                <p className="mt-5 max-w-lg text-base leading-relaxed text-bone-muted">
                  {data.campaign.summary}
                </p>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={`/heartfelt/${data.campaign.slug}`}>See the campaign</ButtonLink>
                <ButtonLink href="/heartfelt" variant="outline">
                  All causes
                </ButtonLink>
              </div>
            </div>
            {data.campaign.goalCents > 0 ? (
              <div className="panel self-center p-8">
                <p className="eyebrow mb-4">Impact so far</p>
                <p className="font-display text-5xl leading-none text-bone">
                  {formatCents(data.campaign.raisedCents)}
                </p>
                <p className="mt-2 text-sm text-bone-dim">
                  raised toward a {formatCents(data.campaign.goalCents)} goal
                </p>
                <div className="mt-6">
                  <CampaignProgress raised={data.campaign.raisedCents} goal={data.campaign.goalCents} />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- MEMBERSHIP */}
      <section className="container-page py-20">
        <div className="panel overflow-hidden">
          <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="eyebrow">Membership</p>
              <h2 className="mt-4 text-4xl leading-none sm:text-5xl">
                JOIN THE <span className="gold-text">FAMILY</span>
              </h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-bone-muted">
                Members unlock premium video, early releases, member-only stories and shop discounts.
                Real memberships. Real money. No coins, no tokens, no gimmicks.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/membership" size="lg">
                  Compare tiers
                </ButtonLink>
                <ButtonLink href="/creator/join" variant="outline" size="lg">
                  Become a creator
                </ButtonLink>
              </div>
            </div>

            <div className="grid gap-3">
              {data.membershipPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between gap-4 border border-ink-600 bg-ink-800/60 px-5 py-4"
                >
                  <div>
                    <p className="font-display text-lg uppercase tracking-tight text-bone">{plan.name}</p>
                    {plan.tagline ? <p className="text-xs text-bone-dim">{plan.tagline}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl text-gold-400">
                      {plan.priceCents === 0 ? 'Free' : formatCents(plan.priceCents)}
                    </p>
                    {plan.priceCents > 0 ? (
                      <p className="text-[10px] uppercase tracking-[0.16em] text-bone-dim">
                        per {plan.interval}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
              {data.membershipPlans.length === 0 ? (
                <p className="text-sm text-bone-dim">
                  Membership tiers are configured in Admin → Memberships.
                </p>
              ) : null}
              <Link
                href="/membership"
                className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400 hover:text-gold-300"
              >
                See what’s included <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
