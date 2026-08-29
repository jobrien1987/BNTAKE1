import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/auth/auth-forms';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="panel px-6 py-8 sm:px-8">
        <h1 className="text-3xl leading-none sm:text-4xl">Link not valid</h1>
        <p className="mt-3 text-sm text-bone-dim">
          This reset link is missing its token. Request a new one and use the most recent email.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block border-b border-gold-700/60 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400 hover:text-gold-300"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="panel px-6 py-8 sm:px-8">
      <p className="eyebrow">Account recovery</p>
      <h1 className="mt-2 text-3xl leading-none sm:text-4xl">Set a new password</h1>
      <p className="mt-3 text-sm text-bone-dim">
        Choose a new password. Signing in again on your other devices will be required.
      </p>

      <div className="mt-8">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
