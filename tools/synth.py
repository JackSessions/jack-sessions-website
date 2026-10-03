import numpy as np, sys, subprocess
from scipy.signal import butter, lfilter, fftconvolve
SR = 44100
rng = np.random.default_rng(7)
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def lp(x, fc, order=2): b, a = butter(order, min(fc, SR/2-100)/(SR/2), 'low'); return lfilter(b, a, x)
def hp(x, fc, order=2): b, a = butter(order, fc/(SR/2), 'high'); return lfilter(b, a, x)

class Track:
    def __init__(s, bpm, bars):
        s.bpm, s.bars = bpm, bars
        s.beat = 60.0 / bpm
        s.n = int(SR * s.beat * 4 * bars) + SR * 3
        s.buses = {k: np.zeros((2, s.n)) for k in ['drums', 'bass', 'pad', 'lead', 'arp', 'fx']}
        s.kicks = []
    def t(s, bar, beat): return (bar * 4 + beat) * s.beat
    def add(s, bus, x, start, pan=0.0):
        i = int(start * SR); x = x[: s.n - i]
        if x.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            s.buses[bus][0, i:i+len(x)] += x * l * 1.414; s.buses[bus][1, i:i+len(x)] += x * r * 1.414
        else:
            s.buses[bus][:, i:i+x.shape[1]] += x[:, : s.n - i]

def env(n, a=0.005, d=0.1, sus=0.7, r=0.1):
    e = np.ones(n); na, nd, nr = int(a*SR), int(d*SR), int(r*SR)
    na = max(1, min(na, n)); e[:na] = np.linspace(0, 1, na)
    nd = min(nd, n - na); e[na:na+nd] = np.linspace(1, sus, nd); e[na+nd:] = sus
    nr = min(nr, n); e[n-nr:] *= np.linspace(1, 0, nr)
    return e

def saw(freq, n, phase=0.0): return np.mod(freq * np.arange(n) / SR + phase, 1.0) * 2 - 1
def supersaw(freq, n, voices=5, spread=14, seed=0):
    r = np.random.default_rng(seed); out = np.zeros(n)
    for c in np.linspace(-spread, spread, voices):
        out += saw(freq * 2 ** (c / 1200), n, r.random())
    return out / voices
def pluck(freq, n, decay=0.18, cutoff=3500):
    x = saw(freq, n) * 0.6 + np.sign(saw(freq, n)) * 0.3
    e = np.exp(-np.arange(n) / (decay * SR))
    return lp(x, cutoff) * e

def kick(vol=1.0):
    n = int(0.42 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7.5) + 0.25 * np.sin(2*ph) * np.exp(-t*20)
    click = np.random.default_rng(1).standard_normal(n) * np.exp(-t * 300) * 0.15
    return (x + click) * vol
def snare(vol=1.0, tone=190):
    n = int(0.35 * SR); t = np.arange(n) / SR
    noise = hp(rng.standard_normal(n), 1500) * np.exp(-t * 16)
    body = np.sin(2*np.pi*tone*t) * np.exp(-t * 28) * 0.6
    return (noise * 0.9 + body) * vol
def clap(vol=1.0):
    n = int(0.3 * SR); t = np.arange(n) / SR
    x = hp(lp(rng.standard_normal(n), 6500), 900)
    e = sum(np.exp(-np.maximum(t - d, 0) * 60) * (t >= d) for d in (0, 0.012, 0.024)) * 0.4 + np.exp(-np.maximum(t-0.03, 0)*18) * (t >= 0.03)
    return x * e * vol * 0.8
def hat(vol=1.0, open_=False):
    n = int((0.28 if open_ else 0.06) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (14 if open_ else 70)) * vol * 0.5

def reverb(x, secs=2.2, damp=5000, wet=1.0):
    n = int(secs * SR); t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = lp(np.random.default_rng(10 + ch).standard_normal(n), damp) * np.exp(-t * 3.2)
        ir[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
        out[ch] = fftconvolve(x[ch], ir / np.sqrt(np.sum(ir**2)) * 0.12)[: x.shape[1]]
    return out * wet
def delay(x, time, fb=0.4, taps=5, pingpong=True):
    out = np.zeros_like(x); d = int(time * SR)
    for k in range(1, taps + 1):
        sh = d * k; g = fb ** k
        ch = (k % 2) if pingpong else 0
        if sh < x.shape[1]:
            src = x[0] + x[1]
            out[ch, sh:] += src[: x.shape[1] - sh] * g * 0.5
            out[1 - ch, sh:] += src[: x.shape[1] - sh] * g * 0.2
    return out
def sidechain(tr, depth=0.7, rel=0.22):
    g = np.ones(tr.n)
    for k in tr.kicks:
        i = int(k * SR); m = min(int(rel * 3 * SR), tr.n - i)
        if m > 0: g[i:i+m] = np.minimum(g[i:i+m], 1 - depth * np.exp(-np.arange(m) / (rel * SR)))
    return g
def riser(dur, lo=300, hi=9000):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n); seg = 2048
    for i in range(0, n, seg):
        fc = lo * (hi / lo) ** (i / n); out[i:i+seg] = lp(x[i:i+seg], fc, 1)
    return out * np.linspace(0, 1, n) ** 2 * 0.5
def chord_pad(tr, bar, notes, nbeats=4, vol=0.22, cutoff=2400, bus='pad'):
    n = int(tr.beat * nbeats * SR + 0.3 * SR)
    for ch in range(2):
        x = np.zeros(n)
        for j, m in enumerate(notes): x += supersaw(mtof(m), n, 5, 16, seed=j + ch * 9)
        x = lp(x / len(notes), cutoff) * env(n, 0.25, 0.3, 0.8, 0.3) * vol
        tr.buses[bus][ch, int(tr.t(bar, 0) * SR): int(tr.t(bar, 0) * SR) + n] += x[: tr.n - int(tr.t(bar, 0) * SR)]

EXTRA = None
def finish(tr, path, reverb_sends, sc_buses, sc_depth=0.65, delay_time=None):
    if EXTRA: EXTRA(tr)
    sc = sidechain(tr, sc_depth)
    mix = tr.buses['drums'] * 0.95
    for b in ['bass', 'pad', 'arp']:
        mix = mix + tr.buses[b] * (sc if b in sc_buses else 1.0)
    mix = mix + tr.buses['lead'] + tr.buses['fx']
    send = sum(tr.buses[b] * w for b, w in reverb_sends.items())
    mix = mix + reverb(send, 2.4)
    if delay_time:
        mix = mix + delay(tr.buses['arp'] + tr.buses['lead'], delay_time, 0.45)
    mix = np.tanh(mix * 0.9) ; mix = mix / np.max(np.abs(mix)) * 0.7
    end = int(SR * tr.beat * 4 * tr.bars) + int(SR * 2.5); mix = mix[:, :end]
    fade = int(SR * 2.0); mix[:, -fade:] *= np.linspace(1, 0, fade)
    pcm = (mix.T * 32767).astype(np.int16)
    import wave
    wav = path + '.wav'
    with wave.open(wav, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '160k', path + '.mp3'], check=True)

# ---------------------------------------------------------------- Track 1: synthwave
def night_shift(out):
    tr = Track(100, 32)
    prog = [(57, [57, 60, 64, 67]), (53, [53, 57, 60, 64]), (48, [48, 52, 55, 59]), (55, [55, 59, 62, 66])]  # Am9-ish, F, C, G
    arp_pat = [0, 1, 2, 3, 2, 1, 2, 3]
    sections = {range(0, 4): 'intro', range(4, 12): 'a', range(12, 16): 'break', range(16, 28): 'b', range(28, 32): 'out'}
    sec = lambda bar: next(v for k, v in sections.items() if bar in k)
    lead_notes = [69, 72, 76, 72, 71, 67, 69, 0, 65, 69, 72, 69, 67, 71, 74, 0]
    for bar in range(32):
        s_ = sec(bar); root, ch = prog[bar % 4]
        chord_pad(tr, bar, [n + 12 * (i % 2 == 0 and 0) for i, n in enumerate(ch)], vol=0.2)
        if s_ in ('a', 'b', 'intro', 'out'):
            for step in range(16):                        # 16th arp
                m = ch[arp_pat[step % 8]] + 12 + (12 if (step // 8) % 2 and s_ == 'b' else 0)
                tr.add('arp', pluck(mtof(m), int(0.3 * SR), 0.16, 4200) * 0.28, tr.t(bar, step * 0.25), pan=-0.4 + 0.8 * (step % 2))
        if s_ in ('a', 'b', 'break', 'out') or bar >= 2:
            for e in range(8):                           # driving bass 8ths
                f = mtof(root - 12 + (12 if e in (3, 7) and s_ == 'b' else 0))
                n = int(0.2 * SR); x = lp(saw(f, n) + 0.6 * np.sign(saw(f / 2, n)), 700) * env(n, 0.003, 0.08, 0.7, 0.05)
                tr.add('bass', x * 0.5, tr.t(bar, e * 0.5))
        if s_ in ('a', 'b', 'out') and not (s_ == 'out' and bar > 29) or bar in (2, 3):
            for b in range(4):
                tr.add('drums', kick(0.95), tr.t(bar, b)); tr.kicks.append(tr.t(bar, b))
            for b in (1, 3): tr.add('drums', snare(0.8), tr.t(bar, b)); tr.add('fx', snare(0.5), tr.t(bar, b))
            for e in range(8): tr.add('drums', hat(0.5, e % 2 == 1 and s_ == 'b'), tr.t(bar, e * 0.5 + (0.25 if False else 0)), pan=0.3)
        if s_ == 'break':
            for b in (1, 3): tr.add('drums', clap(0.6), tr.t(bar, b))
        if s_ in ('a', 'b') and bar % 4 in (0, 2):        # lead hook
            for k in range(8):
                m = lead_notes[(bar % 4 // 2 * 8 + k) % 16]
                if m: 
                    n = int(0.42 * SR); x = lp(supersaw(mtof(m + 12 * (s_ == 'b')), n, 3, 9, k), 3800) * env(n, 0.01, 0.2, 0.6, 0.15)
                    tr.add('lead', x * 0.30, tr.t(bar, k * 0.5))
        if bar == 15: tr.add('fx', riser(tr.beat * 4), tr.t(bar, 0))
    finish(tr, out, {'pad': 0.5, 'lead': 0.5, 'arp': 0.25, 'fx': 0.35}, ['bass', 'pad', 'arp'], 0.6, delay_time=tr.beat * 0.75)

# ---------------------------------------------------------------- Track 2: trancewave
def packet_loss(out):
    tr = Track(138, 48)
    prog = [(54, [54, 57, 61, 66]), (50, [50, 54, 57, 62]), (52, [52, 56, 59, 64]), (47, [47, 51, 54, 59])]  # F#m D E B-ish
    prog = [(54, [54, 57, 61]), (50, [50, 54, 57]), (45, [45, 49, 52]), (52, [52, 56, 59])]
    sections = {range(0, 8): 'intro', range(8, 16): 'build', range(16, 32): 'drop', range(32, 40): 'break', range(40, 46): 'drop2', range(46, 48): 'out'}
    sec = lambda bar: next(v for k, v in sections.items() if bar in k)
    arp = [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2]
    for bar in range(48):
        s_ = sec(bar); root, ch = prog[(bar // 2) % 4]
        if s_ in ('intro', 'build', 'drop', 'break', 'drop2'):
            chord_pad(tr, bar, [n + 12 for n in ch], vol=0.17 if s_ != 'break' else 0.26, cutoff=1800 + (bar - 8) * 90 if s_ == 'build' else 3200)
        if s_ in ('build', 'drop', 'drop2', 'intro') and bar >= 2:
            for step in range(16):
                m = ch[arp[step]] + 24 + (12 if step % 8 == 7 else 0)
                tr.add('arp', pluck(mtof(m), int(0.2 * SR), 0.10, 3000 + (bar - 8) * 150 if s_ == 'build' else 5000) * 0.34, tr.t(bar, step * 0.25), pan=-0.5 + (step % 4) / 3)
        if s_ in ('drop', 'drop2'):
            for e in range(4):                          # offbeat rolling bass: 16ths minus the kick position
                for q in (1, 2, 3):
                    n = int(0.11 * SR); f = mtof(root - 12)
                    x = lp(saw(f, n) + np.sign(saw(f, n)) * 0.4, 520) * env(n, 0.002, 0.05, 0.85, 0.02)
                    tr.add('bass', x * 0.62, tr.t(bar, e + q * 0.25))
            for ch_i, nm in enumerate(ch):             # supersaw stabs on beat 2 and 4 'and'
                pass
            for pos in (0.5, 1.5, 2.5, 3.5) if bar % 2 == 0 else (0.5, 1.0, 2.5, 3.0):
                n = int(0.22 * SR); x = np.zeros(n)
                for j, m in enumerate(ch): x += supersaw(mtof(m + 12), n, 5, 18, j)
                x = lp(x / 3, 4200) * env(n, 0.004, 0.08, 0.4, 0.08)
                tr.add('lead', x * 0.30, tr.t(bar, pos))
        if s_ in ('intro', 'build', 'drop', 'drop2') or bar == 47:
            quiet = s_ == 'intro' and bar < 4
            if not quiet and not (s_ == 'out'):
                for b in range(4): tr.add('drums', kick(1.0), tr.t(bar, b)); tr.kicks.append(tr.t(bar, b))
        if s_ in ('drop', 'drop2', 'build') and bar >= 12 or s_ in ('drop', 'drop2'):
            for b in (1, 3): tr.add('drums', clap(0.8), tr.t(bar, b))
            for b in range(4): tr.add('drums', hat(0.7, True), tr.t(bar, b + 0.5))
        if s_ in ('drop', 'drop2'):
            for e in range(16): tr.add('drums', hat(0.25), tr.t(bar, e * 0.25), pan=0.4)
        if s_ == 'build' and bar >= 12:                  # snare roll accelerating
            div = {12: 1, 13: 2, 14: 4, 15: 8}[bar]
            for k in range(int(4 * div / 1)): tr.add('drums', snare(0.35 + 0.1 * (bar - 12)), tr.t(bar, k / div), pan=0)
        if s_ == 'break' and bar in (36, 37, 38, 39):   # melodic break: lead line
            mel = [66, 69, 73, 69, 68, 64, 66, 64]
            for k, m in enumerate(mel):
                n = int(0.5 * SR); x = lp(supersaw(mtof(m + 12), n, 3, 10, k), 4000) * env(n, 0.01, 0.25, 0.6, 0.2)
                tr.add('lead', x * 0.30, tr.t(bar, k * 0.5))
        if bar in (15, 39): tr.add('fx', riser(tr.beat * 8 if bar == 39 else tr.beat * 4), tr.t(bar - (1 if bar == 39 else 0), 0))
        if bar in (16, 40): tr.add('fx', (kick(1.3) * 0.5), tr.t(bar, 0))
    finish(tr, out, {'pad': 0.45, 'lead': 0.45, 'arp': 0.2, 'fx': 0.3}, ['bass', 'pad', 'arp'], 0.72, delay_time=tr.beat * 0.75)

# ---------------------------------------------------------------- Track 3: dark synthwave
def kernel_panic(out):
    tr = Track(112, 36)
    prog = [(45, [45, 48, 52, 55]), (45, [45, 48, 52, 55]), (41, [41, 45, 48, 52]), (43, [43, 47, 50, 53])]
    prog = [(45, [45, 48, 52]), (41, [41, 45, 48]), (43, [43, 46, 50]), (40, [40, 44, 47])]
    for bar in range(36):
        root, ch = prog[bar % 4]
        chord_pad(tr, bar, [n + 12 for n in ch], vol=0.2, cutoff=1500)
        if bar >= 4:
            for e in range(16):                        # gated, pulsing 16th bass
                n = int(0.12 * SR); f = mtof(root - 12)
                x = lp(saw(f, n) * 0.7 + np.sign(saw(f * 1.005, n)) * 0.5, 450 + 300 * (e % 4 == 0)) * env(n, 0.002, 0.04, 0.8, 0.03)
                tr.add('bass', x * (0.55 if e % 4 else 0.7), tr.t(bar, e * 0.25))
        if bar >= 8:
            for b in range(4): tr.add('drums', kick(1.0), tr.t(bar, b)); tr.kicks.append(tr.t(bar, b))
            for b in (1, 3): tr.add('drums', snare(0.9, 170), tr.t(bar, b)); tr.add('fx', snare(0.6, 170), tr.t(bar, b))
            for e in range(8): tr.add('drums', hat(0.4 + 0.2 * (e % 2)), tr.t(bar, e * 0.5 + 0.25 * 0), pan=0.3)
        if bar >= 12 and bar % 8 < 6 or bar >= 28:
            rr = rng.permutation(3)
            for step in range(8):                      # sparse eerie arp
                m = ch[(step * 2) % 3] + 24
                tr.add('arp', pluck(mtof(m), int(0.35 * SR), 0.25, 2600) * 0.3, tr.t(bar, step * 0.5), pan=(-1) ** step * 0.5)
        if bar >= 16 and bar % 4 in (0, 1, 2):
            mel = [72, 71, 69, 64, 67, 69]
            n = int(0.9 * SR); m = mel[(bar * 2 + (bar % 4)) % 6]
            x = lp(supersaw(mtof(m + 0), n, 3, 12, bar), 3000) * env(n, 0.02, 0.3, 0.6, 0.4)
            tr.add('lead', x * 0.33, tr.t(bar, 0)); tr.add('lead', x * 0.25, tr.t(bar, 2.0))
        if bar in (7, 15, 27): tr.add('fx', riser(tr.beat * 4), tr.t(bar, 0))
    finish(tr, out, {'pad': 0.55, 'lead': 0.55, 'arp': 0.3, 'fx': 0.4}, ['bass', 'pad', 'arp'], 0.6, delay_time=tr.beat * 0.75)

if __name__ == '__main__':
    which, out = sys.argv[1], sys.argv[2]
    {'night': night_shift, 'packet': packet_loss, 'kernel': kernel_panic}[which](out)
