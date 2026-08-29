import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { can } from '@/lib/rbac';
import { ArticleEditor } from '@/components/admin/article-editor';
import { AdminPageHeader } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit story',
  robots: { index: false, follow: false },
};

/** Formats a date for a datetime-local input, which needs local wall time. */
function toLocalInput(date: Date | null) {
  if (!date) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requirePermission('culture.write');

  const [article, categories, authors] = await Promise.all([
    prisma.article.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true } }),
    prisma.author.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  if (!article) notFound();

  return (
    <div>
      <AdminPageHeader
        eyebrow="Culture"
        title={article.title}
        description={`/culture/${article.slug}`}
        action={
          article.status === 'PUBLISHED' ? (
            <Link
              href={`/culture/${article.slug}`}
              className="text-[11px] uppercase tracking-[0.16em] text-gold-400 hover:text-gold-300"
            >
              View live
            </Link>
          ) : undefined
        }
      />

      <ArticleEditor
        canPublish={can(actor.role, 'culture.publish')}
        categories={categories}
        authors={authors}
        values={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          dek: article.dek ?? '',
          excerpt: article.excerpt ?? '',
          body: article.body,
          heroImageUrl: article.heroImageUrl ?? '',
          thumbnailUrl: article.thumbnailUrl ?? '',
          seoTitle: article.seoTitle ?? '',
          seoDescription: article.seoDescription ?? '',
          categoryId: article.categoryId ?? '',
          authorId: article.authorId ?? '',
          status: article.status,
          publishedAt: toLocalInput(article.publishedAt),
          featured: article.featured,
          breaking: article.breaking,
        }}
      />
    </div>
  );
}
