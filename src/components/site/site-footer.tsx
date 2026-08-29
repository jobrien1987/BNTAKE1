import Link from 'next/link';
import { FOOTER_NAV } from '@/lib/nav';
import { getSettings } from '@/server/services/settings';
import { NewsletterForm } from './newsletter-form';

export async function SiteFooter() {
  const settings = await getSettings();
  const socials = [
    { label: 'Instagram', href: settings.instagramUrl },
    { label: 'X', href: settings.twitterUrl },
    { label: 'YouTube', href: settings.youtubeUrl },
    { label: 'TikTok', href: settings.tiktokUrl },
  ].filter((social) => Boolean(social.href));

  return (
    <footer className="mt-24 border-t border-ink-600 bg-ink-900">
      <div className="container-page py-14">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="font-display text-3xl leading-none sm:text-4xl">
              BOOSIE <span className="gold-text">NETWORK</span>
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-bone-dim">{settings.tagline}</p>
            <NewsletterForm />
            {socials.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-4">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold uppercase tracking-[0.18em] text-bone-dim transition-colors hover:text-gold-400"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_NAV.map((group) => (
              <div key={group.title}>
                <p className="eyebrow mb-4">{group.title}</p>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-bone-dim transition-colors hover:text-bone"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink-700 pt-6 text-xs text-bone-dim sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {settings.siteName}. All rights reserved.</p>
          <p>
            Support:{' '}
            <a href={`mailto:${settings.supportEmail}`} className="text-gold-500 hover:text-gold-400">
              {settings.supportEmail}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
