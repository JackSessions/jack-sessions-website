"""Nightcore / driving electro-pop tracks (180-220 BPM): risers, snare rolls, sidechain pump, filter-opening intros,
key-change lift in the final drop, hard drops with an impact. Instrumental only.
Run:  python tools/synth3.py <overdrive|hyperlink|rooftop|nightdrive|finalboss> out/name"""
import sys
import numpy as np
import synth
from synth import *

MINOR = [0, 2, 3, 5, 7, 8, 10]
def deg(root, d):  # scale degree -> midi note (natural minor)
    return root + MINOR[d % 7] + 12 * (d // 7)
def triad(root, d): return [deg(root, d), deg(root, d + 2), deg(root, d + 4)]

def crash(vol=1.0, dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    return hp(np.random.default_rng(3).standard_normal(n), 5200) * np.exp(-t * 2.4) * vol * 0.6
def boom(dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR; f = 38 + 60 * np.exp(-t * 6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2) * 0.9
def hard_kick(vol=1.0):
    k = kick(1.0); return np.tanh(k * 3.2) * vol * 0.9
def reverse_riser(dur):
    return riser(dur, 200, 11000)[::-1] * 0.0 + riser(dur, 250, 10000)
def reese(f, n, wob):
    t = np.arange(n) / SR
    x = saw(f, n) + saw(f * 1.012, n) + saw(f * 0.988, n)
    cut = 300 + 500 * (0.5 + 0.5 * np.sin(2 * np.pi * wob * t))
    out = np.zeros(n); seg = 1024
    for i in range(0, n, seg): out[i:i+seg] = lp(x[i:i+seg], float(cut[i]), 1)
    return out / 3

def render(out, cfg):
    bpm, secs = cfg['bpm'], cfg['sections']
    total = sum(b for _, b in secs); tr = Track(bpm, total)
    marks = []; c = 0
    for name, b in secs: marks.append((name, c, c + b)); c += b
    secof = lambda bar: next(n for n, a, b in marks if a <= bar < b)
    startof = lambda bar: next(a for n, a, b in marks if a <= bar < b)
    lenof = lambda bar: next(b - a for n, a, b in marks if a <= bar < b)
    prog = cfg['prog']; motif = cfg['motif']
    for bar in range(total):
        s_ = secof(bar); off = bar - startof(bar); L = lenof(bar)
        lift = 2 if s_ == 'drop2' else 0                        # key change lift in the final drop
        root = cfg['root'] + lift
        d = prog[bar % len(prog)]; ch = triad(root, d); bassnote = deg(root, d) - 24
        drop = s_ in ('drop', 'drop2'); nxt = secof(bar + 1) if bar + 1 < total else 'end'

        # ---- harmony: filter opens through intro/build
        cut = {'intro': 900 + 150 * off, 'build': 1800 + 140 * off, 'break': 2200, 'outro': 2200}.get(s_, 3600)
        if s_ != 'outro' or off < L - 2:
            chord_pad(tr, bar, [n + 12 for n in ch] + [ch[0] + 24], vol=0.15 if drop else 0.2, cutoff=cut)
        # ---- arps
        if s_ in ('intro', 'build', 'drop', 'drop2', 'outro') and not (s_ == 'intro' and off < 2):
            pat = cfg['arp']
            for step in range(16):
                m = ch[pat[step % len(pat)] % 3] + 24 + 12 * (pat[step % len(pat)] // 3)
                tr.add('arp', pluck(mtof(m), int(0.18 * SR), 0.09, 3000 + (900 if drop else 0)) * (0.3 if drop else 0.24), tr.t(bar, step * 0.25), pan=-0.5 + (step % 4) / 3)
        # ---- bass
        if drop or (s_ == 'build' and off >= L // 2):
            style = cfg['bass']
            if style == 'offbeat':
                for b in range(4):
                    n = int(0.16 * SR); f = mtof(bassnote); tr.add('bass', lp(saw(f, n) + np.sign(saw(f, n)) * 0.35, 650) * env(n, 0.002, 0.06, 0.7, 0.03) * 0.62, tr.t(bar, b + 0.5))
            elif style == 'roll':
                for b in range(4):
                    for q in (1, 2, 3):
                        n = int(0.09 * SR); f = mtof(bassnote); tr.add('bass', lp(saw(f, n) + np.sign(saw(f, n)) * 0.4, 560) * env(n, 0.002, 0.04, 0.85, 0.02) * 0.6, tr.t(bar, b + q * 0.25))
            elif style == 'reese':
                for b in range(2):
                    n = int(tr.beat * 2 * 0.95 * SR); tr.add('bass', reese(mtof(bassnote), n, 3.0 + b) * env(n, 0.005, 0.1, 0.9, 0.05) * 0.7, tr.t(bar, b * 2))
            else:  # octave 8ths
                for e in range(8):
                    n = int(0.12 * SR); f = mtof(bassnote + (12 if e % 2 else 0)); tr.add('bass', lp(saw(f, n), 600) * env(n, 0.002, 0.05, 0.8, 0.03) * 0.6, tr.t(bar, e * 0.5))
        # ---- drums
        kick_on = drop or (s_ == 'build' and off >= L // 2) or (s_ == 'intro' and off >= L - 2) or (s_ == 'outro' and off < 3)
        if kick_on and not (s_ == 'build' and off == L - 1):
            kfn = hard_kick if cfg['kick'] == 'hard' else kick
            kp = [0, 1, 2, 3] if cfg['drums'] in ('four', 'hard') else [0, 1.75, 2.5] if cfg['drums'] == 'break' else [0, 1, 2, 3]
            for b in kp: tr.add('drums', kfn(1.0), tr.t(bar, b)); tr.kicks.append(tr.t(bar, b))
        if drop:
            sn = [1, 3]
            for b in sn:
                tr.add('drums', clap(0.9), tr.t(bar, b)); tr.add('drums', snare(0.55, 200), tr.t(bar, b)); tr.add('fx', snare(0.4), tr.t(bar, b))
            if cfg['drums'] == 'break': tr.add('drums', snare(0.3, 220), tr.t(bar, 1.75)); tr.add('drums', snare(0.3, 220), tr.t(bar, 3.5))
            for b in range(4): tr.add('drums', hat(0.7, True), tr.t(bar, b + 0.5), pan=0.3)
            for e in range(16): tr.add('drums', hat(0.22 + 0.1 * (e % 4 == 2)), tr.t(bar, e * 0.25), pan=-0.3)
            if off == 0: tr.add('fx', crash(), tr.t(bar, 0)); tr.add('fx', boom(), tr.t(bar, 0))
            if off % 8 == 7:                                   # fill into the next phrase
                for k in range(8): tr.add('drums', snare(0.35 + 0.05 * k), tr.t(bar, 2 + k * 0.25))
        if s_ == 'break':
            for b in (1, 3): tr.add('drums', clap(0.45), tr.t(bar, b))
            if off == 0: tr.add('fx', crash(0.7), tr.t(bar, 0))
        # ---- builds: rolling snares + riser + a gap right before the drop
        if s_ == 'build':
            half = off >= L // 2
            div = 2 if off < L - 2 else 4 if off == L - 2 else 8
            if half:
                for k in range(int(4 * div) - (2 if off == L - 1 else 0)):
                    tr.add('drums', snare(0.25 + 0.03 * off), tr.t(bar, k / div))
            if off == 0 or off == L - 4: tr.add('fx', riser(tr.beat * 4 * min(4, L - off)), tr.t(bar, 0))
        if s_ in ('drop', 'drop2') and off == 0:
            tr.add('fx', hard_kick(1.3), tr.t(bar, 0))
        # ---- lead hook
        if drop or s_ == 'break':
            hook = motif[(bar % 2)]
            for step, dg, ln in hook:
                if dg is None: continue
                m = deg(root, dg) + 12 * (2 if s_ != 'break' else 1)
                n = int(ln * tr.beat * SR * 0.95)
                x = lp(supersaw(mtof(m), n, 5, 14, bar + step), 4800) * env(n, 0.005, 0.12, 0.7, 0.06)
                tr.add('lead', x * (0.3 if drop else 0.36), tr.t(bar, step * 0.25), pan=0.0)
                tr.add('lead', lp(saw(mtof(m - 12), n), 1500) * env(n, 0.005, 0.1, 0.7, 0.05) * 0.14, tr.t(bar, step * 0.25))
        if s_ == 'outro' and off == 0: tr.add('fx', crash(0.8), tr.t(bar, 0))
    finish(tr, out, {'pad': 0.45, 'lead': 0.4, 'arp': 0.22, 'fx': 0.3}, ['bass', 'pad', 'arp'], cfg.get('sc', 0.7), delay_time=tr.beat * 0.75)

# motif = [bar-even pattern, bar-odd pattern]; each is list of (16th step, scale degree or None, length in beats)
H = lambda *a: list(a)
CONFIGS = {
    'overdrive': dict(bpm=180, root=57, prog=[0, 5, 2, 6], arp=[0, 3, 1, 4, 2, 5, 1, 4], bass='offbeat', drums='four', kick='soft',
        sections=None,
        motif=[H((0, 7, 0.5), (2, 9, 0.25), (3, 7, 0.25), (4, 6, 0.5), (6, 4, 0.5), (8, 6, 0.5), (10, 7, 0.75)), H((0, 9, 0.5), (2, 10, 0.25), (3, 9, 0.25), (4, 7, 0.5), (6, 6, 0.5), (8, 4, 1.0))]),
    'hyperlink': dict(bpm=190, root=54, prog=[0, 5, 2, 6], arp=[0, 2, 4, 2, 0, 2, 5, 3], bass='roll', drums='four', kick='soft',
        sections=None,
        motif=[H((0, 4, 0.5), (2, 7, 0.5), (4, 9, 0.5), (6, 7, 0.25), (7, 6, 0.25), (8, 7, 0.5), (10, 4, 0.5), (12, 6, 0.5)), H((0, 5, 0.5), (2, 7, 0.5), (4, 10, 0.5), (6, 9, 0.5), (8, 7, 1.0), (12, 6, 0.5))]),
    'rooftop': dict(bpm=200, root=50, prog=[0, 3, 5, 6], arp=[0, 4, 2, 5, 3, 1, 4, 2], bass='reese', drums='break', kick='soft', sc=0.6,
        sections=None,
        motif=[H((0, 7, 0.75), (3, 6, 0.25), (4, 4, 0.5), (6, 6, 0.5), (8, 7, 0.5), (10, 9, 0.5), (12, 7, 0.5)), H((0, 6, 0.75), (3, 4, 0.25), (4, 2, 0.5), (6, 4, 0.5), (8, 6, 1.0), (12, 4, 0.5))]),
    'nightdrive': dict(bpm=210, root=52, prog=[0, 5, 6, 4], arp=[0, 1, 2, 1, 0, 2, 1, 2], bass='octave', drums='four', kick='soft', sc=0.75,
        sections=None,
        motif=[H((0, 9, 0.5), (2, 7, 0.5), (4, 6, 0.5), (6, 7, 0.5), (8, 9, 0.5), (10, 11, 0.5), (12, 9, 0.5)), H((0, 8, 0.5), (2, 6, 0.5), (4, 5, 0.5), (6, 6, 0.5), (8, 8, 1.0), (12, 6, 0.5))]),
    'finalboss': dict(bpm=220, root=55, prog=[0, 5, 2, 6], arp=[0, 3, 5, 3, 1, 4, 5, 4], bass='roll', drums='hard', kick='hard', sc=0.8,
        sections=None,
        motif=[H((0, 7, 0.5), (2, 7, 0.25), (3, 9, 0.25), (4, 10, 0.5), (6, 9, 0.5), (8, 7, 0.5), (10, 6, 0.5), (12, 4, 0.5)), H((0, 9, 0.5), (2, 9, 0.25), (3, 11, 0.25), (4, 12, 0.5), (6, 11, 0.5), (8, 9, 1.0), (12, 7, 0.5))]),
}
def layout(bpm, seconds=170):
    total = round(seconds * bpm / 240 / 8) * 8
    x = total - 112
    return [('intro', 8), ('build', 8), ('drop', 24), ('break', 16), ('build', 8), ('drop', 24), ('break', 8), ('build', 8), ('drop2', x), ('outro', 8)]

if __name__ == '__main__':
    cfg = CONFIGS[sys.argv[1]]; cfg['sections'] = layout(cfg['bpm']); render(sys.argv[2], cfg)
