// Your releases. `kind` picks how it embeds; `embed` is the player URL for that platform.
//
//  spotify    → open track/album, Share → Embed → copy the src URL (https://open.spotify.com/embed/...)
//  soundcloud → Share → Embed → copy the src URL (https://w.soundcloud.com/player/?url=...)
//  bandcamp   → Share/Embed → copy the src URL (https://bandcamp.com/EmbeddedPlayer/...)
//  youtube    → just the 11-char video id
//  file       → your own mp3 in public/music/, e.g. src: '/music/night-shift.mp3' (plays in the Soundtrack player)
export type Release = {
  title: string;
  note?: string;
  kind: 'spotify' | 'soundcloud' | 'bandcamp' | 'youtube' | 'file';
  embed?: string;
  src?: string;
  jp?: string;          // Japanese title shown in the portable-player screen
};

export const MUSIC: Release[] = [
  { title: 'Hacktrack Mashup', jp: 'ハックトラック', kind: 'file', src: '/music/hacktrack-mashup.mp3', note: 'All tracks crossfaded — 3:20' },
  // { title: 'Night Shift', jp: '夜勤', kind: 'file', src: '/music/night-shift.mp3' },
  // { title: 'Night Shift', kind: 'spotify', embed: 'https://open.spotify.com/embed/track/XXXXXXXX' },
  // { title: 'Packet Loss (demo)', kind: 'soundcloud', embed: 'https://w.soundcloud.com/player/?url=...' },
  // { title: 'Live set @ home', kind: 'youtube', embed: 'dQw4w9WgXcQ' },
];
