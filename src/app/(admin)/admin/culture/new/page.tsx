import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { can } from '@/lib/rbac';
import { ArticleEditor } from '@/components/admin/article-editor';
import { AdminPageHeader } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New story',
  robots: { index: false, follow: false },
};

export default async function NewArticlePage() {
  const actor = await requirePermission('culture.write');

  const [categories, authors] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true } }),
    prisma.author.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <AdminPageHeader eyebrow="Culture" title="New story" />

      <ArticleEditor
        canPublish={can(actor.role, 'culture.publish')}
        categories={categories}
        authors={authors}
        values={{
          title: '',
          slug: '',
          dek: '',
          excerpt: '',
          body: '',
          heroImageUrl: '',
          thumbnailUrl: '',
          seoTitle: '',
          seoDescription: '',
          categoryId: '',
          authorId: '',
          status: 'DRAFT',
          publishedAt: '',
          featured: false,
          breaking: false,
        }}
      />
    </div>
  );
}
