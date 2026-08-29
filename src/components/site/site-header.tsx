import { getCurrentUser } from '@/server/auth/session';
import { getCartCount } from '@/server/services/cart';
import { getSettings } from '@/server/services/settings';
import { isStaff } from '@/lib/rbac';
import { HeaderShell } from './header-shell';

export async function SiteHeader() {
  const [user, cartCount, settings] = await Promise.all([
    getCurrentUser(),
    getCartCount().catch(() => 0),
    getSettings(),
  ]);

  return (
    <HeaderShell
      cartCount={cartCount}
      announcement={
        settings.announcementEnabled && settings.announcementText
          ? { text: settings.announcementText, href: settings.announcementHref }
          : null
      }
      user={
        user
          ? {
              id: user.id,
              name: user.name,
              username: user.username,
              avatarUrl: user.avatarUrl,
              isStaff: isStaff(user.role),
              isCreator: user.isCreator,
            }
          : null
      }
    />
  );
}
