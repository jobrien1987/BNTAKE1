import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/auth/guards';
import { dismissReportAction } from '@/app/actions/admin/people';
import { ModerationControls } from '@/components/admin/moderation-controls';
import { AdminPageHeader, AdminTabs } from '@/components/admin/admin-shell';
import { InlineButtonForm } from '@/components/admin/inline-forms';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { relativeTime, truncate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Community moderation',
  robots: { index: false, follow: false },
};

const STATUSES = ['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED'] as const;

export default async function AdminCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  await requirePermission('community.moderate');

  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : 'OPEN';

  const reports = await prisma.report.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { reporter: { select: { name: true, username: true } } },
  });

  // Reports store a polymorphic target id, so the referenced rows are loaded
  // in one batch per type rather than per report.
  const postIds = reports.filter((r) => r.targetType === 'POST').map((r) => r.targetId);
  const commentIds = reports.filter((r) => r.targetType === 'COMMENT').map((r) => r.targetId);
  const userIds = reports.filter((r) => r.targetType === 'USER').map((r) => r.targetId);

  const [posts, comments, users] = await Promise.all([
    postIds.length
      ? prisma.post.findMany({
          where: { id: { in: postIds } },
          select: {
            id: true,
            body: true,
            hidden: true,
            author: { select: { name: true, username: true } },
          },
        })
      : Promise.resolve([]),
    commentIds.length
      ? prisma.comment.findMany({
          where: { id: { in: commentIds } },
          select: {
            id: true,
            body: true,
            hidden: true,
            postId: true,
            author: { select: { name: true, username: true } },
          },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, username: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const postById = new Map(posts.map((post) => [post.id, post] as const));
  const commentById = new Map(comments.map((comment) => [comment.id, comment] as const));
  const userById = new Map(users.map((user) => [user.id, user] as const));

  return (
    <div>
      <AdminPageHeader
        eyebrow="People"
        title="Moderation queue"
        description="Every action taken here is written to the moderation log and the audit trail."
      />

      <AdminTabs
        active={`/admin/community?status=${status}`}
        items={STATUSES.map((entry) => ({
          label: entry,
          href: `/admin/community?status=${entry}`,
        }))}
      />

      {reports.length === 0 ? (
        <EmptyState
          title={status === 'OPEN' ? 'Queue is clear' : `No ${status.toLowerCase()} reports`}
          description="Reports filed by members appear here for review."
        />
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => {
            const post = postById.get(report.targetId);
            const comment = commentById.get(report.targetId);
            const targetUser = userById.get(report.targetId);

            const body = post?.body ?? comment?.body ?? null;
            const author = post?.author ?? comment?.author ?? null;
            const hidden = post?.hidden ?? comment?.hidden ?? false;
            const missing = !post && !comment && !targetUser;

            return (
              <li key={report.id} className="panel p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">{report.reason}</Badge>
                  <Badge>{report.targetType}</Badge>
                  {hidden ? <Badge tone="warn">Hidden</Badge> : null}
                  <span className="text-xs text-bone-dim">
                    reported by @{report.reporter.username} · {relativeTime(report.createdAt)}
                  </span>
                </div>

                {report.details ? (
                  <p className="mt-3 text-sm text-bone-muted">
                    <span className="text-bone-dim">Reporter note: </span>
                    {report.details}
                  </p>
                ) : null}

                <div className="mt-4 border-l-2 border-ink-600 pl-4">
                  {missing ? (
                    <p className="text-sm text-bone-dim">
                      The reported content has already been deleted.
                    </p>
                  ) : targetUser ? (
                    <p className="text-sm text-bone">
                      <Link
                        href={`/community/member/${targetUser.username}`}
                        className="hover:text-gold-300"
                      >
                        {targetUser.name}
                      </Link>{' '}
                      <span className="text-bone-dim">({targetUser.status})</span>
                    </p>
                  ) : (
                    <>
                      {author ? (
                        <p className="text-xs text-bone-dim">
                          by{' '}
                          <Link
                            href={`/community/member/${author.username}`}
                            className="hover:text-gold-300"
                          >
                            {author.name}
                          </Link>
                        </p>
                      ) : null}
                      <p className="mt-1 whitespace-pre-line text-sm text-bone-muted">
                        {truncate(body ?? '', 400)}
                      </p>
                      {post ? (
                        <Link
                          href={`/community/post/${post.id}`}
                          className="mt-2 inline-block text-[11px] uppercase tracking-[0.14em] text-gold-400 hover:text-gold-300"
                        >
                          Open post
                        </Link>
                      ) : null}
                      {comment ? (
                        <Link
                          href={`/community/post/${comment.postId}`}
                          className="mt-2 inline-block text-[11px] uppercase tracking-[0.14em] text-gold-400 hover:text-gold-300"
                        >
                          Open thread
                        </Link>
                      ) : null}
                    </>
                  )}
                </div>

                {status === 'OPEN' || status === 'REVIEWING' ? (
                  <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-ink-700 pt-4">
                    {!missing && report.targetType !== 'USER' ? (
                      <ModerationControls
                        reportId={report.id}
                        targetType={report.targetType}
                        targetId={report.targetId}
                        hidden={hidden}
                      />
                    ) : null}

                    <InlineButtonForm
                      action={dismissReportAction}
                      hidden={{ reportId: report.id }}
                      label="Dismiss report"
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
