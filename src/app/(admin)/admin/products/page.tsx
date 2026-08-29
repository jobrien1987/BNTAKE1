import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { saveProductAction } from '@/app/actions/admin/commerce';
import { EntityForm } from '@/components/admin/entity-form';
import { AdminPageHeader, AdminTable } from '@/components/admin/admin-shell';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { formatCents } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Products',
  robots: { index: false, follow: false },
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  await requirePermission('shop.write');

  const [products, categories, editing] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { name: true } },
        images: { take: 1, orderBy: { position: 'asc' } },
        _count: { select: { variants: true } },
      },
    }),
    prisma.productCategory.findMany({
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
    edit
      ? prisma.product.findUnique({
          where: { id: edit },
          include: { images: { take: 1, orderBy: { position: 'asc' } } },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Commerce"
        title="Products"
        description="Inventory is only ever decremented when a payment succeeds, so nothing can oversell from items sitting in carts."
        action={
          edit ? (
            <ButtonLink href="/admin/products" variant="outline" size="sm">
              Cancel edit
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="mb-10">
        <EntityForm
          action={saveProductAction}
          title={editing ? `Edit ${editing.title}` : 'Add a product'}
          submitLabel={editing ? 'Save product' : 'Create product'}
          hidden={{ id: editing?.id }}
          fields={[
            { kind: 'text', name: 'title', label: 'Title', required: true, value: editing?.title },
            {
              kind: 'select',
              name: 'categoryId',
              label: 'Category',
              value: editing?.categoryId ?? '',
              options: [
                { value: '', label: 'Uncategorised' },
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ],
            },
            {
              kind: 'textarea',
              name: 'description',
              label: 'Description',
              rows: 5,
              full: true,
              value: editing?.description,
            },
            {
              kind: 'number',
              name: 'priceCents',
              label: 'Price (cents)',
              hint: '3500 = $35.00',
              required: true,
              min: 0,
              value: editing?.priceCents ?? '',
            },
            {
              kind: 'number',
              name: 'salePriceCents',
              label: 'Sale price (cents)',
              hint: 'Leave blank for no sale. Must be below the regular price.',
              min: 0,
              value: editing?.salePriceCents ?? '',
            },
            {
              kind: 'number',
              name: 'inventory',
              label: 'Inventory',
              min: 0,
              value: editing?.inventory ?? 0,
            },
            { kind: 'text', name: 'sku', label: 'SKU', value: editing?.sku },
            {
              kind: 'url',
              name: 'imageUrl',
              label: 'Primary image URL',
              full: true,
              value: editing?.images[0]?.url,
            },
            {
              kind: 'url',
              name: 'digitalAssetUrl',
              label: 'Digital download URL',
              hint: 'Required for digital products.',
              full: true,
              value: editing?.digitalAssetUrl,
            },
            {
              kind: 'checkbox',
              name: 'trackInventory',
              label: 'Track inventory',
              value: editing?.trackInventory ?? true,
            },
            {
              kind: 'checkbox',
              name: 'requiresShipping',
              label: 'Requires shipping',
              value: editing?.requiresShipping ?? true,
            },
            {
              kind: 'checkbox',
              name: 'isDigital',
              label: 'Digital product',
              hint: 'Digital products never ship and are granted to the buyer’s library.',
              value: editing?.isDigital,
            },
            { kind: 'checkbox', name: 'active', label: 'Active', value: editing?.active ?? true },
            { kind: 'checkbox', name: 'featured', label: 'Featured', value: editing?.featured },
          ]}
        />
      </div>

      {products.length === 0 ? (
        <EmptyState title="No products" description="Add the first product above." />
      ) : (
        <AdminTable head={['Product', 'Price', 'Stock', 'Status', '']}>
          {products.map((product) => {
            const soldOut =
              !product.isDigital && product.trackInventory && product.inventory <= 0;

            return (
              <tr key={product.id}>
                <td className="px-4 py-3">
                  <p className="text-bone">{product.title}</p>
                  <p className="text-xs text-bone-dim">
                    {[product.category?.name, `/${product.slug}`].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-1 flex gap-1">
                    {product.isDigital ? <Badge tone="gold">Digital</Badge> : null}
                    {product.featured ? <Badge>Featured</Badge> : null}
                    {product._count.variants > 0 ? (
                      <Badge>{product._count.variants} variants</Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-bone-dim">
                  {formatCents(product.salePriceCents ?? product.priceCents)}
                  {product.salePriceCents ? (
                    <span className="ml-1 line-through">{formatCents(product.priceCents)}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs">
                  {product.isDigital || !product.trackInventory ? (
                    <span className="text-bone-dim">Unlimited</span>
                  ) : soldOut ? (
                    <span className="text-[#ff9aa2]">Sold out</span>
                  ) : (
                    <span className="text-bone-dim">{product.inventory}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={product.active ? 'success' : 'neutral'}>
                    {product.active ? 'Active' : 'Hidden'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link
                      href={`/admin/products?edit=${product.id}`}
                      className="text-[11px] uppercase tracking-[0.14em] text-bone-dim hover:text-gold-300"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/shop/${product.slug}`}
                      className="text-[11px] uppercase tracking-[0.14em] text-bone-dim hover:text-gold-300"
                    >
                      View
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      )}
    </div>
  );
}
