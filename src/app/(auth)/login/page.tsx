import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { safeRedirectPath } from '@/lib/utils';
import { LoginForm } from '@/components/auth/auth-forms';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Boosie Network account.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; reset?: string; registered?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeRedirectPath(params.returnTo, '/account');

  const user = await getCurrentUser();
  if (user) redirect(returnTo);

  const notice = params.reset
    ? 'Your password has been updated. Sign in with your new password.'
    : null;

  return (
    <div className="panel px-6 py-8 sm:px-8">
      <p className="eyebrow">Members</p>
      <h1 className="mt-2 text-3xl leading-none sm:text-4xl">Sign in</h1>
      <p className="mt-3 text-sm text-bone-dim">
        Your library, orders, membership and the community feed live here.
      </p>

      <div className="mt-8">
        <LoginForm returnTo={returnTo} notice={notice} />
      </div>
    </div>
  );
}
