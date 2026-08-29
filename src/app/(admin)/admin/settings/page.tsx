import type { Metadata } from 'next';
import { requirePermission } from '@/server/auth/guards';
import { getSettings } from '@/server/services/settings';
import { flags, env } from '@/lib/env';
import { storageDriver } from '@/server/services/storage';
import { saveSettingsAction } from '@/app/actions/admin/commerce';
import { EntityForm } from '@/components/admin/entity-form';
import { AdminPageHeader, AdminTable } from '@/components/admin/admin-shell';
import { Badge } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await requirePermission('settings.write');

  const settings = await getSettings();

  // Secrets are never rendered — only whether each integration resolved.
  const integrations = [
    { name: 'Payments (Stripe)', ok: flags.stripeEnabled, detail: 'STRIPE_SECRET_KEY' },
    {
      name: 'Stripe webhook',
      ok: flags.stripeWebhookConfigured,
      detail: 'STRIPE_WEBHOOK_SECRET — required for orders to be marked paid',
    },
    {
      name: 'Object storage',
      ok: storageDriver === 's3',
      detail: storageDriver === 's3' ? 'S3-compatible bucket' : 'Local disk fallback',
    },
    {
      name: 'Email',
      ok: flags.emailConfigured,
      detail: `Provider: ${env.EMAIL_PROVIDER}`,
    },
    {
      name: 'Live streaming',
      ok: flags.liveEnabled,
      detail: 'FEATURE_LIVE_ENABLED',
    },
  ];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations"
        title="Settings"
        description="Site-wide configuration. Secrets live in environment variables and are never editable or visible here."
      />

      <div className="mb-10">
        <EntityForm
          action={saveSettingsAction}
          title="Site details"
          submitLabel="Save settings"
          fields={[
            {
              kind: 'text',
              name: 'siteName',
              label: 'Site name',
              required: true,
              value: settings.siteName,
            },
            {
              kind: 'text',
              name: 'supportEmail',
              label: 'Support email',
              value: settings.supportEmail,
            },
            {
              kind: 'text',
              name: 'tagline',
              label: 'Tagline',
              full: true,
              value: settings.tagline,
            },
            {
              kind: 'text',
              name: 'announcementText',
              label: 'Announcement banner text',
              full: true,
              value: settings.announcementText,
            },
            {
              kind: 'text',
              name: 'announcementHref',
              label: 'Announcement link',
              placeholder: '/culture/some-story',
              full: true,
              value: settings.announcementHref,
            },
            {
              kind: 'text',
              name: 'radioStationSlug',
              label: 'Default radio station slug',
              value: settings.radioStationSlug,
            },
            {
              kind: 'text',
              name: 'instagramUrl',
              label: 'Instagram URL',
              value: settings.instagramUrl,
            },
            { kind: 'text', name: 'twitterUrl', label: 'X URL', value: settings.twitterUrl },
            { kind: 'text', name: 'youtubeUrl', label: 'YouTube URL', value: settings.youtubeUrl },
            { kind: 'text', name: 'tiktokUrl', label: 'TikTok URL', value: settings.tiktokUrl },
            {
              kind: 'checkbox',
              name: 'announcementEnabled',
              label: 'Show announcement banner',
              value: settings.announcementEnabled,
            },
            {
              kind: 'checkbox',
              name: 'communityEnabled',
              label: 'Community enabled',
              value: settings.communityEnabled,
            },
            {
              kind: 'checkbox',
              name: 'donationsEnabled',
              label: 'Donations enabled',
              value: settings.donationsEnabled,
            },
          ]}
        />
      </div>

      <section>
        <h2 className="eyebrow mb-4">Integration status</h2>
        <AdminTable head={['Integration', 'Status', 'Configured by']}>
          {integrations.map((integration) => (
            <tr key={integration.name}>
              <td className="px-4 py-3 text-bone">{integration.name}</td>
              <td className="px-4 py-3">
                <Badge tone={integration.ok ? 'success' : 'warn'}>
                  {integration.ok ? 'Configured' : 'Not configured'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-xs text-bone-dim">{integration.detail}</td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </div>
  );
}
