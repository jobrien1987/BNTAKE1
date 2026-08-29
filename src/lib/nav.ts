export interface NavItem {
  label: string;
  href: string;
  description?: string;
}

/** The seven public pillars. */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Culture', href: '/culture', description: 'Hip-hop, music and entertainment news' },
  { label: 'Watch', href: '/watch', description: 'Movies, documentaries and exclusives' },
  { label: 'Listen', href: '/listen', description: 'Songs, albums, artists and radio' },
  { label: 'Live', href: '/live', description: 'Scheduled streams and replays' },
  { label: 'Shop', href: '/shop', description: 'Merch, physical goods and digital drops' },
  { label: 'Community', href: '/community', description: 'The network feed' },
  { label: 'Heartfelt', href: '/heartfelt', description: 'Giving back' },
];

export const ACCOUNT_NAV: NavItem[] = [
  { label: 'Overview', href: '/account' },
  { label: 'Profile', href: '/account/profile' },
  { label: 'Membership', href: '/account/membership' },
  { label: 'Library', href: '/account/library' },
  { label: 'Orders', href: '/account/orders' },
  { label: 'Following', href: '/account/following' },
  { label: 'Notifications', href: '/account/notifications' },
  { label: 'Settings', href: '/account/settings' },
];

export const CREATOR_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/creator' },
  { label: 'Artist profile', href: '/creator/profile' },
  { label: 'Music', href: '/creator/music' },
  { label: 'Albums', href: '/creator/albums' },
  { label: 'Products', href: '/creator/products' },
  { label: 'Analytics', href: '/creator/analytics' },
];

export interface AdminNavGroup {
  label: string;
  items: Array<NavItem & { permission: string }>;
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin', permission: 'admin.access' }],
  },
  {
    label: 'Content',
    items: [
      { label: 'Culture', href: '/admin/culture', permission: 'culture.read' },
      { label: 'Homepage', href: '/admin/homepage', permission: 'homepage.write' },
      { label: 'Watch', href: '/admin/watch', permission: 'watch.write' },
      { label: 'Artists', href: '/admin/artists', permission: 'music.write' },
      { label: 'Music', href: '/admin/music', permission: 'music.write' },
      { label: 'Radio', href: '/admin/radio', permission: 'music.write' },
      { label: 'Live', href: '/admin/live', permission: 'watch.write' },
      { label: 'Heartfelt', href: '/admin/heartfelt', permission: 'heartfelt.write' },
      { label: 'Media', href: '/admin/media', permission: 'media.upload' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { label: 'Products', href: '/admin/products', permission: 'shop.write' },
      { label: 'Orders', href: '/admin/orders', permission: 'orders.read' },
      { label: 'Memberships', href: '/admin/memberships', permission: 'memberships.manage' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Users', href: '/admin/users', permission: 'users.read' },
      { label: 'Creators', href: '/admin/creators', permission: 'creators.manage' },
      { label: 'Community', href: '/admin/community', permission: 'community.moderate' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Settings', href: '/admin/settings', permission: 'settings.write' },
      { label: 'Audit log', href: '/admin/audit', permission: 'audit.read' },
    ],
  },
];

export const FOOTER_NAV = [
  {
    title: 'Network',
    links: [
      { label: 'Culture', href: '/culture' },
      { label: 'Watch', href: '/watch' },
      { label: 'Listen', href: '/listen' },
      { label: 'Badazz Radio', href: '/radio' },
      { label: 'Live', href: '/live' },
    ],
  },
  {
    title: 'Shop',
    links: [
      { label: 'All products', href: '/shop' },
      { label: 'Cart', href: '/cart' },
      { label: 'Orders', href: '/account/orders' },
      { label: 'Library', href: '/account/library' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'The feed', href: '/community' },
      { label: 'Heartfelt', href: '/heartfelt' },
      { label: 'Membership', href: '/membership' },
      { label: 'Become a creator', href: '/creator/join' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Terms', href: '/legal/terms' },
      { label: 'Privacy', href: '/legal/privacy' },
    ],
  },
];
