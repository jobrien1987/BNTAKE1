'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertPermission } from '@/server/auth/guards';
import { assignableRoles } from '@/lib/rbac';
import { destroyAllSessions } from '@/server/auth/session';
import { recordAudit } from '@/server/audit';
import { notify } from '@/server/services/notifications';
import { actionError, fromZod, type ActionState } from '@/lib/action-state';
import type { Role } from '@prisma/client';

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['USER', 'ARTIST', 'ARTIST_PRO', 'EDITOR', 'MODERATOR', 'ADMIN', 'OWNER']),
});

export async function setUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await assertPermission('roles.write');

  const parsed = roleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Invalid role change.', fromZod(parsed.error.flatten()));
  }

  // An actor can only grant roles at or below their own level — this is what
  // stops an ADMIN minting another OWNER.
  const allowed = assignableRoles(actor.role);
  if (!allowed.includes(parsed.data.role as Role)) {
    return actionError('You cannot assign that role.');
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true, name: true },
  });
  if (!target) return actionError('That account no longer exists.');

  if (target.id === actor.id) {
    return actionError('You cannot change your own role.');
  }

  // Nor can they demote someone who outranks them.
  if (!allowed.includes(target.role)) {
    return actionError('You cannot modify an account with a higher role than yours.');
  }

  // The last OWNER must never be demoted, or the install locks itself out.
  if (target.role === 'OWNER' && parsed.data.role !== 'OWNER') {
    const owners = await prisma.user.count({ where: { role: 'OWNER' } });
    if (owners <= 1) {
      return actionError('You cannot demote the only remaining owner.');
    }
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  await recordAudit({
    actorId: actor.id,
    action: 'user.role_change',
    entityType: 'User',
    entityId: target.id,
    metadata: { from: target.role, to: parsed.data.role },
  });

  await notify({
    userId: target.id,
    type: 'SYSTEM',
    title: 'Your account role changed',
    body: `Your role is now ${parsed.data.role}.`,
    href: '/account',
  });

  revalidatePath('/admin/users');
  return { success: `${target.name} is now ${parsed.data.role}.` };
}

const statusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
  reason: z.string().trim().max(300).optional(),
});

export async function setUserStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await assertPermission('users.write');

  const parsed = statusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return actionError('Invalid status change.', fromZod(parsed.error.flatten()));
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, role: true, name: true, status: true },
  });
  if (!target) return actionError('That account no longer exists.');

  if (target.id === actor.id) return actionError('You cannot change your own status.');

  if (!assignableRoles(actor.role).includes(target.role)) {
    return actionError('You cannot modify an account with a higher role than yours.');
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { status: parsed.data.status },
  });

  // Suspension or a ban must take effect immediately, not at session expiry.
  if (parsed.data.status !== 'ACTIVE') {
    await destroyAllSessions(target.id);
  }

  await recordAudit({
    actorId: actor.id,
    action: 'user.status_change',
    entityType: 'User',
    entityId: target.id,
    metadata: { from: target.status, to: parsed.data.status, reason: parsed.data.reason },
  });

  revalidatePath('/admin/users');
  return { success: `${target.name} is now ${parsed.data.status}.` };
}

const creatorSchema = z.object({
  profileId: z.string().min(1),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
});

export async function setCreatorStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await assertPermission('creators.manage');

  const parsed = creatorSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return actionError('Invalid creator status.');

  const profile = await prisma.creatorProfile.findUnique({
    where: { id: parsed.data.profileId },
    include: { user: { select: { id: true, role: true, name: true } } },
  });
  if (!profile) return actionError('That creator profile no longer exists.');

  await prisma.$transaction(async (tx) => {
    await tx.creatorProfile.update({
      where: { id: profile.id },
      data: {
        status: parsed.data.status,
        approvedAt: parsed.data.status === 'APPROVED' ? new Date() : null,
      },
    });

    // isCreator is a display flag; the paid role comes from the subscription
    // webhook, so approval never silently grants a paid tier.
    await tx.user.update({
      where: { id: profile.userId },
      data: { isCreator: parsed.data.status === 'APPROVED' },
    });
  });

  await recordAudit({
    actorId: actor.id,
    action: 'creator.status_change',
    entityType: 'CreatorProfile',
    entityId: profile.id,
    metadata: { to: parsed.data.status },
  });

  await notify({
    userId: profile.userId,
    type: 'SYSTEM',
    title:
      parsed.data.status === 'APPROVED'
        ? 'Your creator application was approved'
        : `Your creator status is now ${parsed.data.status}`,
    href: '/creator',
  });

  revalidatePath('/admin/creators');
  return { success: `${profile.displayName} is now ${parsed.data.status}.` };
}

const moderationSchema = z.object({
  targetType: z.enum(['POST', 'COMMENT', 'USER']),
  targetId: z.string().min(1),
  action: z.enum(['HIDE', 'RESTORE', 'DELETE']),
  reportId: z.string().optional(),
  reason: z.string().trim().max(300).optional(),
});

export async function moderateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await assertPermission('community.moderate');

  const parsed = moderationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return actionError('Invalid moderation action.');

  const { targetType, targetId, action } = parsed.data;

  if (targetType === 'POST') {
    if (action === 'DELETE') {
      await prisma.post.delete({ where: { id: targetId } }).catch(() => undefined);
    } else {
      await prisma.post
        .update({ where: { id: targetId }, data: { hidden: action === 'HIDE' } })
        .catch(() => undefined);
    }
  } else if (targetType === 'COMMENT') {
    if (action === 'DELETE') {
      await prisma.comment.delete({ where: { id: targetId } }).catch(() => undefined);
    } else {
      await prisma.comment
        .update({ where: { id: targetId }, data: { hidden: action === 'HIDE' } })
        .catch(() => undefined);
    }
  }

  await prisma.moderationAction.create({
    data: {
      moderatorId: actor.id,
      action,
      targetType,
      targetId,
      reason: parsed.data.reason || null,
    },
  });

  if (parsed.data.reportId) {
    await prisma.report.update({
      where: { id: parsed.data.reportId },
      data: { status: 'ACTIONED', resolvedAt: new Date() },
    });
  }

  await recordAudit({
    actorId: actor.id,
    action: 'community.moderate',
    entityType: targetType,
    entityId: targetId,
    metadata: { action },
  });

  revalidatePath('/admin/community');
  revalidatePath('/community');
  return { success: 'Moderation action recorded.' };
}

export async function dismissReportAction(formData: FormData) {
  const actor = await assertPermission('community.moderate');
  const id = String(formData.get('reportId') ?? '');
  if (!id) return;

  await prisma.report.update({
    where: { id },
    data: { status: 'DISMISSED', resolvedAt: new Date() },
  });

  await recordAudit({
    actorId: actor.id,
    action: 'report.dismiss',
    entityType: 'Report',
    entityId: id,
  });

  revalidatePath('/admin/community');
}
