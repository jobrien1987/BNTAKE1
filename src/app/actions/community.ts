'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertUser, AuthorizationError } from '@/server/auth/guards';
import { clientIp } from '@/server/auth/session';
import { rateLimit, RATE_LIMITS } from '@/server/rate-limit';
import { toPlainText } from '@/server/services/sanitize';
import { notify } from '@/server/services/notifications';
import { track } from '@/server/services/analytics';
import { recordAudit } from '@/server/audit';
import { actionError, fromZod, type ActionState } from '@/lib/action-state';

const MAX_POST_LENGTH = 2000;
const MAX_COMMENT_LENGTH = 1000;

function authFailure(error: unknown): ActionState | null {
  if (error instanceof AuthorizationError) {
    return actionError('Sign in to take part in the community.');
  }
  return null;
}

const postSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something first.')
    .max(MAX_POST_LENGTH, `Keep posts under ${MAX_POST_LENGTH} characters.`),
  imageUrl: z.string().url().optional().or(z.literal('')).transform((value) => value || null),
});

export async function createPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let user;
  try {
    user = await assertUser();
  } catch (error) {
    return authFailure(error) ?? actionError('Something went wrong.');
  }

  if (user.status !== 'ACTIVE') {
    return actionError('Your account cannot post right now.');
  }

  const limit = await rateLimit(
    `post:${user.id}`,
    RATE_LIMITS.post.limit,
    RATE_LIMITS.post.windowSeconds,
  );
  if (!limit.allowed) {
    return actionError('You are posting too quickly. Take a breath and try again shortly.');
  }

  const parsed = postSchema.safeParse({
    body: formData.get('body'),
    imageUrl: formData.get('imageUrl') ?? '',
  });
  if (!parsed.success) {
    return actionError('Please check your post.', fromZod(parsed.error.flatten()));
  }

  // Posts are plain text. Stripping markup here means the feed can never be
  // used to inject HTML into another member's page.
  const body = toPlainText(parsed.data.body, MAX_POST_LENGTH);
  if (!body.trim()) return actionError('Write something first.');

  const post = await prisma.post.create({
    data: { authorId: user.id, body, imageUrl: parsed.data.imageUrl },
    select: { id: true },
  });

  await track({ name: 'post_create', userId: user.id, entityType: 'post', entityId: post.id });

  revalidatePath('/community');
  return { success: 'Posted.' };
}

export async function deletePostAction(formData: FormData) {
  const user = await assertUser();
  const postId = String(formData.get('postId') ?? '');
  if (!postId) return;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post) return;

  const isModerator =
    user.role === 'MODERATOR' || user.role === 'ADMIN' || user.role === 'OWNER';
  if (post.authorId !== user.id && !isModerator) {
    throw new AuthorizationError('You cannot delete this post.');
  }

  await prisma.post.delete({ where: { id: postId } });

  if (post.authorId !== user.id) {
    await recordAudit({
      actorId: user.id,
      action: 'post.delete',
      entityType: 'Post',
      entityId: postId,
    });
  }

  revalidatePath('/community');
}

const commentSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  body: z
    .string()
    .trim()
    .min(1, 'Write a comment first.')
    .max(MAX_COMMENT_LENGTH, `Keep comments under ${MAX_COMMENT_LENGTH} characters.`),
});

export async function createCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let user;
  try {
    user = await assertUser();
  } catch (error) {
    return authFailure(error) ?? actionError('Something went wrong.');
  }

  if (user.status !== 'ACTIVE') return actionError('Your account cannot comment right now.');

  const limit = await rateLimit(
    `comment:${user.id}`,
    RATE_LIMITS.comment.limit,
    RATE_LIMITS.comment.windowSeconds,
  );
  if (!limit.allowed) return actionError('Slow down for a moment before commenting again.');

  const parsed = commentSchema.safeParse({
    postId: formData.get('postId'),
    parentId: formData.get('parentId') || null,
    body: formData.get('body'),
  });
  if (!parsed.success) {
    return actionError('Please check your comment.', fromZod(parsed.error.flatten()));
  }

  const post = await prisma.post.findUnique({
    where: { id: parsed.data.postId },
    select: { id: true, authorId: true, hidden: true },
  });
  if (!post || post.hidden) return actionError('That post is no longer available.');

  const body = toPlainText(parsed.data.body, MAX_COMMENT_LENGTH);
  if (!body.trim()) return actionError('Write a comment first.');

  await prisma.$transaction([
    prisma.comment.create({
      data: {
        postId: post.id,
        authorId: user.id,
        parentId: parsed.data.parentId ?? null,
        body,
      },
    }),
    prisma.post.update({
      where: { id: post.id },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  if (post.authorId !== user.id) {
    await notify({
      userId: post.authorId,
      type: 'COMMENT',
      title: `${user.name} commented on your post`,
      body: body.slice(0, 120),
      href: `/community/post/${post.id}`,
    });
  }

  revalidatePath(`/community/post/${post.id}`);
  revalidatePath('/community');
  return { success: 'Comment posted.' };
}

export async function deleteCommentAction(formData: FormData) {
  const user = await assertUser();
  const commentId = String(formData.get('commentId') ?? '');
  if (!commentId) return;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, postId: true },
  });
  if (!comment) return;

  const isModerator =
    user.role === 'MODERATOR' || user.role === 'ADMIN' || user.role === 'OWNER';
  if (comment.authorId !== user.id && !isModerator) {
    throw new AuthorizationError('You cannot delete this comment.');
  }

  await prisma.$transaction([
    prisma.comment.delete({ where: { id: commentId } }),
    prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    }),
  ]);

  revalidatePath(`/community/post/${comment.postId}`);
}

/** Like/unlike is a single toggle so double submits settle on one state. */
export async function togglePostLikeAction(formData: FormData) {
  const user = await assertUser();
  const postId = String(formData.get('postId') ?? '');
  if (!postId) return;

  const existing = await prisma.reaction.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.reaction.delete({ where: { id: existing.id } }),
      prisma.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.reaction.create({ data: { userId: user.id, postId } }),
      prisma.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
    ]);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (post && post.authorId !== user.id) {
      await notify({
        userId: post.authorId,
        type: 'REACTION',
        title: `${user.name} liked your post`,
        href: `/community/post/${postId}`,
      });
    }
  }

  revalidatePath('/community');
  revalidatePath(`/community/post/${postId}`);
}

export async function toggleCommentLikeAction(formData: FormData) {
  const user = await assertUser();
  const commentId = String(formData.get('commentId') ?? '');
  const postId = String(formData.get('postId') ?? '');
  if (!commentId) return;

  const existing = await prisma.reaction.findUnique({
    where: { userId_commentId: { userId: user.id, commentId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.reaction.delete({ where: { id: existing.id } }),
      prisma.comment.update({ where: { id: commentId }, data: { likeCount: { decrement: 1 } } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.reaction.create({ data: { userId: user.id, commentId } }),
      prisma.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } }),
    ]);
  }

  if (postId) revalidatePath(`/community/post/${postId}`);
}

export async function toggleArtistFollowAction(formData: FormData) {
  const user = await assertUser();
  const artistId = String(formData.get('artistId') ?? '');
  if (!artistId) return;

  const existing = await prisma.artistFollow.findUnique({
    where: { userId_artistId: { userId: user.id, artistId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.artistFollow.delete({ where: { id: existing.id } }),
      prisma.artist.update({ where: { id: artistId }, data: { followerCount: { decrement: 1 } } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.artistFollow.create({ data: { userId: user.id, artistId } }),
      prisma.artist.update({ where: { id: artistId }, data: { followerCount: { increment: 1 } } }),
    ]);
    await track({ name: 'follow', userId: user.id, entityType: 'artist', entityId: artistId });
  }

  const artist = await prisma.artist.findUnique({
    where: { id: artistId },
    select: { slug: true },
  });
  if (artist) revalidatePath(`/artists/${artist.slug}`);
  revalidatePath('/account/following');
}

export async function toggleUserFollowAction(formData: FormData) {
  const user = await assertUser();
  const targetId = String(formData.get('userId') ?? '');
  if (!targetId || targetId === user.id) return;

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId: targetId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    await prisma.follow.create({ data: { followerId: user.id, followingId: targetId } });
    await notify({
      userId: targetId,
      type: 'FOLLOW',
      title: `${user.name} followed you`,
      href: `/community/member/${user.username}`,
    });
  }

  revalidatePath('/account/following');
}

const reportSchema = z.object({
  targetType: z.enum(['POST', 'COMMENT', 'USER']),
  targetId: z.string().min(1),
  reason: z.enum(['SPAM', 'HARASSMENT', 'HATE', 'VIOLENCE', 'SEXUAL', 'MISINFORMATION', 'OTHER']),
  details: z.string().trim().max(500).optional(),
});

export async function reportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let user;
  try {
    user = await assertUser();
  } catch (error) {
    return authFailure(error) ?? actionError('Something went wrong.');
  }

  const parsed = reportSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Please pick a reason.', fromZod(parsed.error.flatten()));
  }

  const ip = await clientIp();
  const limit = await rateLimit(`report:${user.id}:${ip ?? 'anon'}`, 20, 60 * 60);
  if (!limit.allowed) return actionError('You have filed a lot of reports. Try again later.');

  await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details ? toPlainText(parsed.data.details, 500) : null,
    },
  });

  return { success: 'Thanks — the moderation team will review this.' };
}

export async function toggleBlockAction(formData: FormData) {
  const user = await assertUser();
  const blockedId = String(formData.get('userId') ?? '');
  if (!blockedId || blockedId === user.id) return;

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.block.delete({ where: { id: existing.id } });
  } else {
    await prisma.block.create({ data: { blockerId: user.id, blockedId } });
    // Blocking also drops any follow relationship in both directions.
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: user.id, followingId: blockedId },
          { followerId: blockedId, followingId: user.id },
        ],
      },
    });
  }

  revalidatePath('/community');
  revalidatePath('/account/settings');
}
