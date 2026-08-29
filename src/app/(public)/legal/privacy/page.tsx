import type { Metadata } from 'next';
import { getSettings } from '@/server/services/settings';
import { formatDate } from '@/lib/utils';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How Boosie Network collects, uses and protects your data.',
  alternates: { canonical: '/legal/privacy' },
};

// Placeholder wording pending legal review — see README before launch.
const EFFECTIVE_DATE = new Date('2025-01-01T00:00:00Z');

export default async function PrivacyPage() {
  const settings = await getSettings();

  return (
    <div className="container-page py-12 sm:py-16">
      <header className="mb-10 border-b border-ink-700 pb-8">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-4xl leading-none sm:text-6xl">PRIVACY POLICY</h1>
        <p className="mt-3 text-sm text-bone-dim">Effective {formatDate(EFFECTIVE_DATE)}</p>
      </header>

      <div className="prose-editorial max-w-2xl">
        <p className="text-bone">
          <strong>
            This document is a working draft written to give the product a complete, functioning
            page. It has not been reviewed by a lawyer and must be replaced with a vetted policy
            before launch.
          </strong>
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details</strong> — your name, username, email address and password
            hash. We never store your password itself.
          </li>
          <li>
            <strong>Order and membership records</strong> — what you bought, when, and the shipping
            address you supplied. Card numbers are handled entirely by our payment processor and
            never reach our servers.
          </li>
          <li>
            <strong>Usage data</strong> — pages viewed, tracks played and searches run, used to
            operate and improve the network.
          </li>
          <li>
            <strong>Technical data</strong> — IP address and browser user agent, recorded with
            sessions and rate limits to keep accounts secure.
          </li>
        </ul>

        <h2>How we use it</h2>
        <p>
          To run your account, fulfil orders, grant access to what you own, keep the platform
          secure, and understand what people want more of. We do not sell your personal data.
        </p>

        <h2>Email</h2>
        <p>
          Transactional email — receipts, password resets and account notices — is always sent.
          Marketing email is opt-in and can be switched off at any time in your account settings.
        </p>

        <h2>Cookies</h2>
        <p>
          We set a session cookie when you sign in and a cart cookie so a basket survives before you
          have an account. Both are strictly functional.
        </p>

        <h2>Processors</h2>
        <p>
          We share the minimum necessary data with a payment processor, an email provider and an
          object storage provider. Each handles it only to deliver its service.
        </p>

        <h2>Your rights</h2>
        <p>
          You can view and edit your profile, export what you own, and request deletion of your
          account. Some records — such as completed order history — are retained where we are
          legally required to keep them.
        </p>

        <h2>Security</h2>
        <p>
          Passwords are hashed, sessions are stored as hashes of opaque tokens, and changing your
          password signs out every device. Report a suspected vulnerability to{' '}
          {settings.supportEmail ? (
            <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
          ) : (
            'our support address'
          )}
          .
        </p>

        <h2>Children</h2>
        <p>
          The network is not intended for children under 13, and we do not knowingly collect their
          data.
        </p>
      </div>
    </div>
  );
}
