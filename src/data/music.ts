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
  { title: 'Night Shift', jp: '夜勤', kind: 'file', src: '/music/night-shift.mp3', note: 'Synthwave, 100 BPM' },
  { title: 'Packet Loss', jp: 'パケットロス', kind: 'file', src: '/music/packet-loss.mp3', note: 'Trancewave, 138 BPM' },
  { title: 'Kernel Panic', jp: 'カーネルパニック', kind: 'file', src: '/music/kernel-panic.mp3', note: 'Dark synthwave, 112 BPM' },
  { title: 'Zero Day', jp: 'ゼロデイ', kind: 'file', src: '/music/zero-day.mp3', note: 'Trap, 140 BPM, beat drops' },
  { title: 'Root Access', jp: 'ルートアクセス', kind: 'file', src: '/music/root-access.mp3', note: 'Boom bap, 92 BPM, hard drops' },
  { title: 'Kill Chain', jp: 'キルチェーン', kind: 'file', src: '/music/kill-chain.mp3', note: 'Drill, 144 BPM, sliding 808s' },
  { title: 'Overdrive', jp: 'オーバードライブ', kind: 'file', src: '/music/overdrive.mp3', note: 'Nightcore, 180 BPM, key-change finale' },
  { title: 'Hyperlink', jp: 'ハイパーリンク', kind: 'file', src: '/music/hyperlink.mp3', note: 'Nightcore, 190 BPM, rolling bass' },
  { title: 'Rooftop Run', jp: '屋上ラン', kind: 'file', src: '/music/rooftop-run.mp3', note: 'Nightcore, 200 BPM, breakbeat + reese' },
  { title: 'Night Drive Overclock', jp: '夜間ドライブ', kind: 'file', src: '/music/night-drive-overclock.mp3', note: 'Nightcore, 210 BPM, synthwave arps' },
  { title: 'Final Boss', jp: 'ラスボス', kind: 'file', src: '/music/final-boss.mp3', note: 'Nightcore, 220 BPM, hard kick anthem' },
  { title: 'Nightcore Mix', jp: 'ナイトコア・ミックス', kind: 'file', src: '/music/nightcore-mix.mp3', note: 'All five, crossfaded, about 14 minutes' },
  // { title: 'Night Shift', jp: '夜勤', kind: 'file', src: '/music/night-shift.mp3' },
  // { title: 'Night Shift', kind: 'spotify', embed: 'https://open.spotify.com/embed/track/XXXXXXXX' },
  // { title: 'Packet Loss (demo)', kind: 'soundcloud', embed: 'https://w.soundcloud.com/player/?url=...' },
  // { title: 'Live set @ home', kind: 'youtube', embed: 'dQw4w9WgXcQ' },
];
