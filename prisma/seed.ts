/**
 * Seeds a working development database.
 *
 * Everything created here is clearly fictional demo content. The only account
 * with real privileges is the development OWNER, whose credentials come from
 * SEED_OWNER_* environment variables — there is no hardcoded password anywhere
 * in this file. If SEED_OWNER_PASSWORD is unset, a strong random password is
 * generated and printed once, at which point it is your job to save it.
 *
 * Safe to run repeatedly: every write is an upsert keyed on a stable slug.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

function generatePassword() {
  // 24 URL-safe characters, then guarantee the character classes our own
  // strength check requires so the seeded account can sign in immediately.
  return `${crypto.randomBytes(18).toString('base64url')}aA1`;
}

const DEMO_NOTE = 'Fictional demo content created by the seed script.';

async function seedOwner() {
  const email = (process.env.SEED_OWNER_EMAIL ?? 'owner@example.com').toLowerCase();
  const name = process.env.SEED_OWNER_NAME ?? 'Network Owner';

  const providedPassword = process.env.SEED_OWNER_PASSWORD;
  const password = providedPassword ?? generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  const owner = await prisma.user.upsert({
    where: { email },
    // An existing owner's password is never overwritten by a re-seed.
    update: { role: 'OWNER', status: 'ACTIVE', name },
    create: {
      email,
      name,
      username: 'owner',
      passwordHash,
      role: 'OWNER',
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
  });

  if (existing) {
    console.log(`\n  Owner account already present: ${email} (password unchanged)`);
  } else if (providedPassword) {
    console.log(`\n  Owner account created: ${email}`);
    console.log('  Password: taken from SEED_OWNER_PASSWORD');
  } else {
    console.log('\n  ─────────────────────────────────────────────────────────────');
    console.log('  DEVELOPMENT OWNER ACCOUNT CREATED');
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log('  This password is shown once and is not stored anywhere.');
    console.log('  Save it now, or set SEED_OWNER_PASSWORD and re-seed.');
    console.log('  ─────────────────────────────────────────────────────────────\n');
  }

  return owner;
}

async function seedPlans() {
  const plans = [
    {
      key: 'FREE' as const,
      kind: 'FAN' as const,
      name: 'Free',
      tagline: 'Everything open on the network.',
      priceCents: 0,
      position: 0,
      memberContentAccess: false,
      perks: ['Read every Culture story', 'Stream free music and video', 'Join the community feed'],
    },
    {
      key: 'FAMILY' as const,
      kind: 'FAN' as const,
      name: 'Family',
      tagline: 'The member library, plus early access.',
      priceCents: 599,
      position: 1,
      memberContentAccess: true,
      earlyAccess: true,
      adFree: true,
      shopDiscountPercent: 5,
      perks: [
        'The full member library',
        'Early access to new releases',
        'Ad-free browsing',
        '5% off everything in the shop',
      ],
    },
    {
      key: 'INSIDER' as const,
      kind: 'FAN' as const,
      name: 'Insider',
      tagline: 'Everything, first, with the biggest discount.',
      priceCents: 1299,
      position: 2,
      memberContentAccess: true,
      earlyAccess: true,
      adFree: true,
      shopDiscountPercent: 15,
      perks: [
        'Everything in Family',
        'Premium titles included',
        '15% off everything in the shop',
        'Priority access to live streams',
      ],
    },
    {
      key: 'ARTIST' as const,
      kind: 'CREATOR' as const,
      name: 'Artist',
      tagline: 'Release your music on the network.',
      priceCents: 1999,
      position: 0,
      canUploadMusic: true,
      maxUploads: 50,
      perks: ['Your own artist page', 'Upload up to 50 tracks', 'Basic performance stats'],
    },
    {
      key: 'ARTIST_PRO' as const,
      kind: 'CREATOR' as const,
      name: 'Artist Pro',
      tagline: 'Unlimited catalogue, merch and live.',
      priceCents: 4900,
      position: 1,
      canUploadMusic: true,
      canSellMerch: true,
      canGoLive: true,
      advancedAnalytics: true,
      maxUploads: null,
      perks: [
        'Everything in Artist',
        'Unlimited uploads',
        'Sell merch through network fulfilment',
        'Go live',
        'Advanced analytics',
      ],
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      // Prices and Stripe IDs are operator-managed, so a re-seed never
      // clobbers what an admin has configured on an existing plan.
      update: { name: plan.name, tagline: plan.tagline, perks: plan.perks },
      create: { ...plan, active: true, visible: true },
    });
  }

  console.log(`  Plans: ${plans.length}`);
}

async function seedCreatorAgreement() {
  const version = '1.0.0';

  await prisma.creatorAgreement.upsert({
    where: { version },
    update: {},
    create: {
      version,
      title: 'Boosie Network Creator Agreement',
      active: true,
      body: `
<p><strong>This is placeholder text for development. Replace it with a lawyer-reviewed agreement before launch.</strong></p>
<h2>1. What you grant us</h2>
<p>You keep ownership of everything you upload. You grant the network a non-exclusive licence to host, stream, promote and sell that work on the platform for as long as it remains published.</p>
<h2>2. What you promise</h2>
<p>You confirm that you hold the rights to everything you submit, including samples, features and artwork, and that publishing it does not breach anyone else's agreement.</p>
<h2>3. Review and publication</h2>
<p>Submissions are reviewed before they go live. We may decline or unpublish work that breaches this agreement or the law.</p>
<h2>4. Money</h2>
<p>Revenue splits, payout timing and thresholds are set out in your plan documentation. Payouts are made in ordinary currency.</p>
<h2>5. Ending it</h2>
<p>You may withdraw your catalogue at any time. Purchases already made by listeners remain valid — buyers keep what they bought.</p>
<h2>6. Versioning</h2>
<p>This agreement is versioned. The version you accepted at signup is the version that binds you until you accept a newer one.</p>
      `.trim(),
    },
  });

  console.log('  Creator agreement: v1.0.0');
}

async function seedTaxonomy() {
  const categories = [
    { name: 'News', slug: 'news', position: 0 },
    { name: 'Interviews', slug: 'interviews', position: 1 },
    { name: 'Features', slug: 'features', position: 2 },
    { name: 'Reviews', slug: 'reviews', position: 3 },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }

  const genres = [
    { name: 'Hip-Hop', slug: 'hip-hop' },
    { name: 'Trap', slug: 'trap' },
    { name: 'Southern Rap', slug: 'southern-rap' },
    { name: 'R&B', slug: 'r-and-b' },
    { name: 'Soul', slug: 'soul' },
  ];

  for (const genre of genres) {
    await prisma.genre.upsert({ where: { slug: genre.slug }, update: {}, create: genre });
  }

  const productCategories = [
    { name: 'Apparel', slug: 'apparel', position: 0 },
    { name: 'Vinyl', slug: 'vinyl', position: 1 },
    { name: 'Accessories', slug: 'accessories', position: 2 },
    { name: 'Digital', slug: 'digital', position: 3 },
  ];

  for (const category of productCategories) {
    await prisma.productCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }

  const author = await prisma.author.upsert({
    where: { slug: 'demo-newsroom' },
    update: {},
    create: {
      name: 'Network Newsroom',
      slug: 'demo-newsroom',
      title: 'Staff',
      bio: DEMO_NOTE,
    },
  });

  console.log(`  Taxonomy: ${categories.length} categories, ${genres.length} genres`);
  return { author };
}

async function seedCatalogue() {
  const hipHop = await prisma.genre.findUnique({ where: { slug: 'hip-hop' } });

  const artistSeeds = [
    {
      slug: 'demo-artist-vega',
      stageName: 'Vega Rain',
      bio: `${DEMO_NOTE} Vega Rain is an invented artist used to demonstrate the catalogue.`,
      location: 'Baton Rouge, LA',
      featured: true,
      verified: true,
    },
    {
      slug: 'demo-artist-mox',
      stageName: 'Mox Delane',
      bio: `${DEMO_NOTE} Mox Delane is an invented artist.`,
      location: 'Houston, TX',
      featured: false,
      verified: false,
    },
    {
      slug: 'demo-artist-ceecee',
      stageName: 'CeeCee Fontaine',
      bio: `${DEMO_NOTE} CeeCee Fontaine is an invented artist.`,
      location: 'Atlanta, GA',
      featured: true,
      verified: true,
    },
  ];

  const artists = [];
  for (const seed of artistSeeds) {
    artists.push(
      await prisma.artist.upsert({
        where: { slug: seed.slug },
        update: {},
        create: { ...seed, status: 'PUBLISHED' },
      }),
    );
  }

  const albumSeeds = [
    {
      slug: 'demo-album-lowlight-hours',
      title: 'Lowlight Hours',
      artistId: artists[0].id,
      description: DEMO_NOTE,
      priceCents: 999,
      purchasable: true,
      accessType: 'PURCHASE' as const,
      featured: true,
      tracks: [
        { title: 'Cold Corner', durationSec: 194, accessType: 'FREE' as const },
        { title: 'Lowlight Hours', durationSec: 221, accessType: 'PURCHASE' as const },
        { title: 'Backroad Prayer', durationSec: 178, accessType: 'MEMBERSHIP' as const },
        { title: 'No Sirens', durationSec: 203, accessType: 'PURCHASE' as const },
      ],
    },
    {
      slug: 'demo-album-paper-crown',
      title: 'Paper Crown',
      artistId: artists[2].id,
      description: DEMO_NOTE,
      priceCents: 799,
      purchasable: true,
      accessType: 'PURCHASE' as const,
      featured: true,
      tracks: [
        { title: 'Paper Crown', durationSec: 187, accessType: 'FREE' as const },
        { title: 'Glass House Blues', durationSec: 210, accessType: 'MEMBERSHIP' as const },
        { title: 'Sunday Money', durationSec: 165, accessType: 'PURCHASE' as const },
      ],
    },
  ];

  let trackCount = 0;

  for (const albumSeed of albumSeeds) {
    const { tracks, ...albumData } = albumSeed;

    const album = await prisma.album.upsert({
      where: { slug: albumData.slug },
      update: {},
      create: {
        ...albumData,
        status: 'PUBLISHED',
        releaseDate: new Date('2024-06-01T00:00:00Z'),
        ...(hipHop ? { genres: { connect: [{ id: hipHop.id }] } } : {}),
      },
    });

    for (const [index, track] of tracks.entries()) {
      const slug = `${albumData.slug}-${index + 1}`;
      await prisma.song.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          title: track.title,
          artistId: albumData.artistId,
          albumId: album.id,
          trackNumber: index + 1,
          durationSec: track.durationSec,
          accessType: track.accessType,
          purchasable: track.accessType === 'PURCHASE',
          priceCents: track.accessType === 'PURCHASE' ? 129 : null,
          status: 'PUBLISHED',
          featured: index === 0,
          releaseDate: new Date('2024-06-01T00:00:00Z'),
          playCount: Math.floor(Math.random() * 4000),
          // No audio URL is set: demo tracks intentionally have no media, and
          // the player reports that honestly rather than failing silently.
        },
      });
      trackCount += 1;
    }
  }

  console.log(`  Catalogue: ${artists.length} artists, ${albumSeeds.length} albums, ${trackCount} tracks`);
  return { artists };
}

async function seedVideos() {
  const videos = [
    {
      slug: 'demo-film-after-the-flood',
      title: 'After the Flood',
      kind: 'MOVIE' as const,
      synopsis: `${DEMO_NOTE} A fictional feature used to demonstrate the Watch catalogue.`,
      durationSec: 5820,
      accessType: 'PURCHASE' as const,
      priceCents: 1499,
      purchasable: true,
      featured: true,
      contentRating: 'R',
      director: 'A. Fictional',
    },
    {
      slug: 'demo-doc-the-long-way-round',
      title: 'The Long Way Round',
      kind: 'DOCUMENTARY' as const,
      synopsis: `${DEMO_NOTE} A fictional documentary.`,
      durationSec: 4320,
      accessType: 'MEMBERSHIP' as const,
      featured: false,
      contentRating: 'PG-13',
    },
    {
      slug: 'demo-interview-studio-session',
      title: 'Studio Session: Vega Rain',
      kind: 'INTERVIEW' as const,
      synopsis: `${DEMO_NOTE} A fictional interview.`,
      durationSec: 1560,
      accessType: 'FREE' as const,
      featured: false,
    },
  ];

  for (const video of videos) {
    await prisma.video.upsert({
      where: { slug: video.slug },
      update: {},
      create: { ...video, status: 'PUBLISHED', releaseDate: new Date('2024-09-15T00:00:00Z') },
    });
  }

  console.log(`  Watch: ${videos.length} titles`);
}

async function seedArticles(authorId: string) {
  const newsCategory = await prisma.category.findUnique({ where: { slug: 'news' } });
  const interviews = await prisma.category.findUnique({ where: { slug: 'interviews' } });

  const articles = [
    {
      slug: 'demo-story-network-launch',
      title: 'The network opens its doors',
      dek: 'A new home for the culture, owned end to end.',
      categoryId: newsCategory?.id,
      breaking: true,
      featured: true,
      body: `<p>${DEMO_NOTE}</p><p>This placeholder story exists so the Culture pillar renders with real layout rather than an empty state. Replace it with actual reporting.</p><h2>What changes</h2><p>Everything in one place: stories, music, film, merch and the community around them.</p>`,
    },
    {
      slug: 'demo-story-vega-rain-interview',
      title: 'Vega Rain on making Lowlight Hours',
      dek: 'The invented artist behind our demo catalogue.',
      categoryId: interviews?.id,
      featured: true,
      body: `<p>${DEMO_NOTE}</p><p>A placeholder interview used to demonstrate article layout, related content and the byline system.</p>`,
    },
    {
      slug: 'demo-story-shop-drop',
      title: 'First merch drop lands this week',
      dek: 'Limited run, shipped worldwide.',
      categoryId: newsCategory?.id,
      body: `<p>${DEMO_NOTE}</p><p>A placeholder story linking Culture to the Shop pillar.</p>`,
    },
  ];

  for (const article of articles) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: {},
      create: {
        ...article,
        authorId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        readMinutes: 3,
        excerpt: DEMO_NOTE,
      },
    });
  }

  console.log(`  Culture: ${articles.length} stories`);
}

async function seedShop() {
  const apparel = await prisma.productCategory.findUnique({ where: { slug: 'apparel' } });
  const vinyl = await prisma.productCategory.findUnique({ where: { slug: 'vinyl' } });
  const digital = await prisma.productCategory.findUnique({ where: { slug: 'digital' } });

  const products = [
    {
      slug: 'demo-product-tour-tee',
      title: 'Demo Tour Tee',
      description: DEMO_NOTE,
      categoryId: apparel?.id,
      priceCents: 3500,
      inventory: 120,
      featured: true,
      variants: ['Small', 'Medium', 'Large', 'XL'],
    },
    {
      slug: 'demo-product-lowlight-vinyl',
      title: 'Lowlight Hours — Vinyl',
      description: DEMO_NOTE,
      categoryId: vinyl?.id,
      priceCents: 4200,
      salePriceCents: 3600,
      inventory: 40,
      variants: [],
    },
    {
      slug: 'demo-product-digital-zine',
      title: 'Network Zine (Digital)',
      description: DEMO_NOTE,
      categoryId: digital?.id,
      priceCents: 500,
      inventory: 0,
      trackInventory: false,
      isDigital: true,
      requiresShipping: false,
      digitalAssetUrl: 'https://example.com/demo/zine.pdf',
      variants: [],
    },
  ];

  for (const product of products) {
    const { variants, ...data } = product;

    const created = await prisma.product.upsert({
      where: { slug: data.slug },
      update: {},
      create: { ...data, active: true },
    });

    for (const [index, variantName] of variants.entries()) {
      const sku = `${data.slug}-${variantName.toLowerCase()}`;
      const existing = await prisma.productVariant.findUnique({ where: { sku } });
      if (existing) continue;

      await prisma.productVariant.create({
        data: {
          productId: created.id,
          name: variantName,
          sku,
          size: variantName,
          inventory: 30,
          position: index,
        },
      });
    }
  }

  console.log(`  Shop: ${products.length} products`);
}

async function seedRadio() {
  const station = await prisma.radioStation.upsert({
    where: { slug: 'badazz-radio' },
    update: {},
    create: {
      slug: 'badazz-radio',
      name: 'Badazz Radio',
      tagline: 'The network, around the clock.',
      description: `${DEMO_NOTE} No stream URL is configured, so the player shows an explanatory disabled state until an administrator sets one.`,
      active: true,
      isLive: false,
    },
  });

  const shows = [
    { slug: 'demo-show-morning-run', title: 'The Morning Run', host: 'DJ Placeholder' },
    { slug: 'demo-show-late-set', title: 'Late Set', host: 'Guest Selector' },
  ];

  for (const show of shows) {
    await prisma.radioShow.upsert({
      where: { slug: show.slug },
      update: {},
      create: { ...show, stationId: station.id, description: DEMO_NOTE },
    });
  }

  console.log('  Radio: Badazz Radio + 2 shows');
}

async function seedHeartfelt() {
  const campaigns = [
    {
      slug: 'demo-campaign-back-to-school',
      title: 'Back to School Backpacks',
      summary: DEMO_NOTE,
      story: `<p>${DEMO_NOTE}</p><p>A placeholder campaign demonstrating the Heartfelt pillar, including progress tracking and updates.</p>`,
      goalCents: 500000,
      raisedCents: 187500,
      category: 'Education',
      location: 'Baton Rouge, LA',
      status: 'ACTIVE' as const,
      featured: true,
      donationEnabled: true,
    },
    {
      slug: 'demo-campaign-winter-coats',
      title: 'Winter Coat Drive',
      summary: DEMO_NOTE,
      story: `<p>${DEMO_NOTE}</p><p>A completed placeholder campaign.</p>`,
      goalCents: 250000,
      raisedCents: 250000,
      category: 'Community',
      status: 'COMPLETED' as const,
      donationEnabled: false,
    },
  ];

  for (const campaign of campaigns) {
    await prisma.campaign.upsert({
      where: { slug: campaign.slug },
      update: {},
      create: campaign,
    });
  }

  console.log(`  Heartfelt: ${campaigns.length} campaigns`);
}

async function seedHomepage() {
  const sections = [
    { key: 'hero', type: 'HERO' as const, title: 'Featured', position: 0 },
    {
      key: 'culture',
      type: 'CULTURE_RAIL' as const,
      title: 'Culture',
      subtitle: 'Reporting from the newsroom',
      ctaLabel: 'All stories',
      ctaHref: '/culture',
      position: 1,
    },
    {
      key: 'watch',
      type: 'WATCH_RAIL' as const,
      title: 'Watch',
      subtitle: 'Movies, docs and exclusives',
      ctaLabel: 'All titles',
      ctaHref: '/watch',
      position: 2,
    },
    {
      key: 'listen',
      type: 'LISTEN_RAIL' as const,
      title: 'Listen',
      subtitle: 'New and notable',
      ctaLabel: 'All music',
      ctaHref: '/listen',
      position: 3,
    },
    { key: 'radio', type: 'RADIO' as const, title: 'Badazz Radio', position: 4 },
    {
      key: 'shop',
      type: 'SHOP_RAIL' as const,
      title: 'Shop',
      ctaLabel: 'All products',
      ctaHref: '/shop',
      position: 5,
    },
    { key: 'spotlight', type: 'ARTIST_SPOTLIGHT' as const, title: 'Artist spotlight', position: 6 },
    {
      key: 'community',
      type: 'COMMUNITY' as const,
      title: 'Community',
      ctaLabel: 'Join the feed',
      ctaHref: '/community',
      position: 7,
    },
    {
      key: 'heartfelt',
      type: 'HEARTFELT' as const,
      title: 'Heartfelt',
      ctaLabel: 'All campaigns',
      ctaHref: '/heartfelt',
      position: 8,
    },
    { key: 'membership', type: 'MEMBERSHIP' as const, title: 'Membership', position: 9 },
  ];

  for (const section of sections) {
    await prisma.homepageSection.upsert({
      where: { key: section.key },
      update: {},
      create: { ...section, enabled: true },
    });
  }

  console.log(`  Homepage: ${sections.length} sections`);
}

async function seedCommunity(ownerId: string) {
  const existing = await prisma.post.count();
  if (existing > 0) {
    console.log('  Community: posts already present, skipped');
    return;
  }

  await prisma.post.create({
    data: {
      authorId: ownerId,
      body: `Welcome to the network. ${DEMO_NOTE} Say what you came to say — just keep it respectful.`,
    },
  });

  console.log('  Community: 1 welcome post');
}

async function main() {
  console.log('\nSeeding Boosie Network…\n');

  const owner = await seedOwner();

  await seedPlans();
  await seedCreatorAgreement();
  const { author } = await seedTaxonomy();
  await seedCatalogue();
  await seedVideos();
  await seedArticles(author.id);
  await seedShop();
  await seedRadio();
  await seedHeartfelt();
  await seedHomepage();
  await seedCommunity(owner.id);

  console.log('\nSeed complete.\n');
}

main()
  .catch((error) => {
    console.error('\nSeed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
