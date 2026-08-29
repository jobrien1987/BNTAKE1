import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { safeRedirectPath } from '@/lib/utils';
import { RegisterForm } from '@/components/auth/auth-forms';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Join the Boosie Network.',
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeRedirectPath(params.returnTo, '/account');

  const user = await getCurrentUser();
  if (user) redirect(returnTo);

  return (
    <div className="panel px-6 py-8 sm:px-8">
      <p className="eyebrow">Join</p>
      <h1 className="mt-2 text-3xl leading-none sm:text-4xl">Create your account</h1>
      <p className="mt-3 text-sm text-bone-dim">
        Free to join. Follow artists, join the feed and keep everything you buy in one library.
      </p>

      <div className="mt-8">
        <RegisterForm returnTo={returnTo} />
      </div>
    </div>
  );
}
