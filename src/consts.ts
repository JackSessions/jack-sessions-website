// Site-wide constants. Edit these first — they feed the header, footer, and <head>.

export const SITE_TITLE = 'Jack Sessions';
export const SITE_DESCRIPTION =
  'Security researcher who ships, speaks, and makes noise — DFIR, vuln research, talks, video, and music.';

// Shown in the header nav, left to right.
export const NAV = [
  { href: '/',         label: 'Home' },
  { href: '/blog',     label: 'Blog' },
  { href: '/projects', label: 'Projects' },
  { href: '/talks',    label: 'Talks' },
  { href: '/homelab',  label: 'Lab' },
  { href: '/videos',   label: 'Videos' },
  { href: '/music',    label: 'Music' },
  { href: '/about',    label: 'About' },
] as const;

// Footer + hero social links. Delete any you don't use.
export const SOCIALS = {
  youtube: 'https://www.youtube.com/@Jack_Sessions',
  github:  'https://github.com/JackSessions',
  linkedin:'https://www.linkedin.com/in/jacksessions/',
  email:   'mailto:JackSessions@protonmail.com',
  credly:  'https://www.credly.com/users/jack_sessions',
};

// OPTIONAL: your YouTube channel ID (starts with "UC...").
// If set, the Videos page pulls your latest uploads automatically at build time.
// Find it at youtube.com → your channel → Share → "Copy channel ID",
// or in Studio → Settings → Channel → Advanced.
// Leave as '' to use the manual list in src/data/videos.ts instead.
export const YOUTUBE_CHANNEL_ID = 'UCvrpsZeZucTuXjqJEg0UeVQ';
