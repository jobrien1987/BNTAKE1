import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/auth-forms';

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="panel px-6 py-8 sm:px-8">
      <p className="eyebrow">Account recovery</p>
      <h1 className="mt-2 text-3xl leading-none sm:text-4xl">Reset your password</h1>
      <p className="mt-3 text-sm text-bone-dim">
        Enter the email on your account and we&rsquo;ll send a link to set a new password. The link
        expires in an hour.
      </p>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
