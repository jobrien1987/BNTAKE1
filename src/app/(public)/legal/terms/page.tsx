import type { Metadata } from 'next';
import { getSettings } from '@/server/services/settings';
import { formatDate } from '@/lib/utils';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The terms that govern use of Boosie Network.',
  alternates: { canonical: '/legal/terms' },
};

// Placeholder wording pending legal review — see README before launch.
const EFFECTIVE_DATE = new Date('2025-01-01T00:00:00Z');

export default async function TermsPage() {
  const settings = await getSettings();

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-10 border-b border-ink-700 pb-8">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-4xl leading-none sm:text-6xl">TERMS OF SERVICE</h1>
        <p className="mt-3 text-sm text-bone-dim">Effective {formatDate(EFFECTIVE_DATE)}</p>
      </header>

      <div className="prose-editorial max-w-2xl">
        <p className="text-bone">
          <strong>
            This document is a working draft written to give the product a complete, functioning
            page. It has not been reviewed by a lawyer and must be replaced with vetted terms before
            launch.
          </strong>
        </p>

        <h2>1. Your account</h2>
        <p>
          You are responsible for the activity on your account and for keeping your password
          private. Tell us immediately if you believe someone else has access. We may suspend an
          account that is being used to break these terms or the law.
        </p>

        <h2>2. What you buy</h2>
        <p>
          When you purchase digital content — a track, album, film or digital release — you receive a
          personal, non-transferable licence to stream and, where offered, download it for your own
          use. That licence does not expire when a membership ends. You may not redistribute,
          resell, or publicly perform purchased content without written permission.
        </p>

        <h2>3. Membership</h2>
        <p>
          Membership grants access to content marked as included with membership for as long as the
          membership is active. It renews automatically at the price shown when you subscribed until
          you cancel. Cancelling stops future renewals; it does not remove content you purchased
          outright.
        </p>

        <h2>4. Physical orders</h2>
        <p>
          Prices are shown in the currency listed at checkout and exclude any taxes or duties
          applied at your destination. We will tell you if an item cannot be fulfilled and refund
          it.
        </p>

        <h2>5. Creator content</h2>
        <p>
          Creators keep ownership of what they upload and grant {settings.siteName} the licence
          needed to host, stream, promote and sell it on the network. Creators are responsible for
          holding the rights to everything they submit. Full terms are in the creator agreement,
          which is versioned — the version you accepted is the one that binds you.
        </p>

        <h2>6. Community conduct</h2>
        <p>
          No harassment, hate speech, threats, spam, impersonation or illegal material. Moderators
          may hide or remove content and suspend accounts. Reports are reviewed by a person.
        </p>

        <h2>7. Availability</h2>
        <p>
          We work to keep the network running but do not guarantee uninterrupted access. Features
          may change, and content may be added or removed.
        </p>

        <h2>8. Changes</h2>
        <p>
          We may update these terms. Material changes will be announced on the site. Continuing to
          use the network after a change means you accept the updated terms.
        </p>

        <h2>9. Contact</h2>
        <p>
          Questions about these terms can be sent to{' '}
          {settings.supportEmail ? (
            <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
          ) : (
            'our support address'
          )}
          .
        </p>
      </div>
    </div>
  );
}
