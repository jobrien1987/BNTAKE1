import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { storageDriver } from '@/server/services/storage';
import { MediaUploader, CopyableUrl } from '@/components/admin/media-uploader';
import { AdminPageHeader } from '@/components/admin/admin-shell';
import { MediaFrame } from '@/components/ui/media-frame';
import { Alert, Badge, EmptyState } from '@/components/ui/primitives';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Media library',
  robots: { index: false, follow: false },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminMediaPage() {
  await requirePermission('media.upload');

  const assets = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { uploadedBy: { select: { name: true } } },
  });

  return (
    <div>
      <AdminPageHeader
        eyebrow="Content"
        title="Media library"
        description="Upload images, audio and video, then paste the returned URL into any editor."
      />

      {storageDriver === 'local' ? (
        <div className="mb-6">
          <Alert tone="warn" title="Local storage fallback">
            Uploads are being written to the local <code>public/uploads</code> directory. That works
            for development but is not durable on most hosts — configure S3 before production.
          </Alert>
        </div>
      ) : null}

      <div className="mb-10">
        <MediaUploader />
      </div>

      {assets.length === 0 ? (
        <EmptyState title="Nothing uploaded yet" description="Upload your first file above." />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((asset) => (
            <figure key={asset.id} className="panel p-3">
              {asset.kind === 'IMAGE' ? (
                <MediaFrame
                  src={asset.url}
                  alt={asset.altText ?? asset.fileName}
                  seed={asset.fileName}
                  ratio="square"
                  className="mb-3 border border-ink-600"
                />
              ) : (
                <div className="mb-3 flex aspect-square items-center justify-center border border-ink-600 bg-ink-800">
                  <Badge>{asset.kind}</Badge>
                </div>
              )}

              <figcaption className="min-w-0">
                <p className="truncate text-xs text-bone" title={asset.fileName}>
                  {asset.fileName}
                </p>
                <p className="text-[11px] text-bone-dim">
                  {formatBytes(asset.sizeBytes)} · {formatDate(asset.createdAt)}
                </p>
                <CopyableUrl url={asset.url} label={`URL for ${asset.fileName}`} />
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
