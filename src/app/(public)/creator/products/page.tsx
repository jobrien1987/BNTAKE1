import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { ProductRequestForm } from '@/components/creator/product-request-form';
import { ProductCard } from '@/components/cards/product-card';
import { Alert, EmptyState, SectionHeader } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your merch',
  robots: { index: false, follow: false },
};

export default async function CreatorProductsPage() {
  const user = await requireUser('/creator/products');

  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: user.id },
    include: { artist: true },
  });

  const products = profile?.artist
    ? await prisma.product.findMany({
        where: { artists: { some: { id: profile.artist.id } } },
        include: { images: { take: 1, orderBy: { position: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <div className="space-y-12">
      <section>
        <SectionHeader
          eyebrow="Live now"
          title="Your products"
          description="Merch tied to your artist page. The network handles fulfilment, inventory and payouts."
        />

        {products.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Once the merch team sets up a product linked to your artist page it appears here."
          />
        ) : (
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={{ ...product, imageUrl: product.images[0]?.url ?? null }}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          eyebrow="Propose"
          title="Request new merch"
          description="Send an idea to the merch team. They handle production, listing and shipping."
        />

        <div className="mb-6">
          <Alert tone="info">
            Creators propose merch rather than listing it directly. That keeps inventory,
            fulfilment and payouts under one roof, so a product can never oversell.
          </Alert>
        </div>

        <ProductRequestForm />
      </section>
    </div>
  );
}
