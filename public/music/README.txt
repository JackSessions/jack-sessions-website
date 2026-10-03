Put your own tracks here (mp3 or m4a), e.g. public/music/night-shift.mp3
Then add a line to src/data/music.ts:
  { title: 'Night Shift', kind: 'file', src: '/music/night-shift.mp3', note: 'Prod. by me' },
Tracks with kind 'file' show up in the Soundtrack player on /music.
Keep each file under 25 MB (Cloudflare limit); 128-192 kbps mp3 is plenty.
