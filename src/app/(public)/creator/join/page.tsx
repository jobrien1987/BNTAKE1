import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/guards';
import { listPlans } from '@/server/services/subscriptions';
import { CreatorJoinForm } from '@/components/creator/join-form';
import { sanitizeRichText } from '@/server/services/sanitize';
import { Alert, Badge, SectionHeader } from '@/components/ui/primitives';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Become a creator',
  description: 'Apply to release music and sell merch on Boosie Network.',
  robots: { index: false, follow: false },
};

export default async function CreatorJoinPage() {
  const user = await requireUser('/creator/join');

  const [profile, agreement, plans] = await Promise.all([
    prisma.creatorProfile.findUnique({
      where: { userId: user.id },
      select: { status: true, tier: true, displayName: true, createdAt: true },
    }),
    prisma.creatorAgreement.findFirst({
      where: { active: true },
      orderBy: { effectiveDate: 'desc' },
    }),
    listPlans('CREATOR'),
  ]);

  if (profile?.status === 'APPROVED') redirect('/creator');

  if (!agreement) {
    return (
      <div className="max-w-2xl">
        <Alert tone="warn" title="Applications are closed">
          No creator agreement has been published yet, so applications cannot be accepted. Please
          check back shortly.
        </Alert>
      </div>
    );
  }

  const tiers = plans
    .filter((plan) => plan.key === 'ARTIST' || plan.key === 'ARTIST_PRO')
    .map((plan) => ({
      key: plan.key as 'ARTIST' | 'ARTIST_PRO',
      name: plan.name,
      priceCents: plan.priceCents,
      interval: plan.interval,
    }));

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <SectionHeader
          eyebrow={`Version ${agreement.version}`}
          title={agreement.title}
          description={`Effective ${formatDate(agreement.effectiveDate)}`}
        />

        <div
          className="prose-editorial"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(agreement.body) }}
        />
      </div>

      <aside>
        <div className="panel p-6">
          {profile?.status === 'PENDING' ? (
            <Alert tone="info" title="Application under review">
              You applied on {formatDate(profile.createdAt)}. We review every application by hand
              and will be in touch.
            </Alert>
          ) : profile?.status === 'SUSPENDED' ? (
            <Alert tone="warn" title="Creator access suspended">
              Contact support to discuss reinstating your creator access.
            </Alert>
          ) : (
            <>
              {profile?.status === 'REJECTED' ? (
                <div className="mb-5">
                  <Alert tone="warn">
                    A previous application was not approved. You are welcome to apply again with
                    updated details.
                  </Alert>
                </div>
              ) : null}

              <div className="mb-5 flex items-center gap-2">
                <Badge tone="gold">Apply</Badge>
                <span className="text-xs text-bone-dim">Takes about two minutes</span>
              </div>

              {tiers.length === 0 ? (
                <Alert tone="warn">
                  No creator plans have been configured yet, so applications cannot be accepted.
                </Alert>
              ) : (
                <CreatorJoinForm
                  agreementId={agreement.id}
                  agreementVersion={agreement.version}
                  tiers={tiers}
                  defaultName={user.name}
                  defaultEmail={user.email}
                />
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
