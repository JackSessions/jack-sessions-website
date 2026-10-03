"""Cyber-themed layer for the site's tracks: hacker SFX, drawn-out robot words, rap beats with drops, and a TTS demo vocal.
Run:  python tools/synth2.py <track> <outfile-without-ext>     tracks: night packet kernel zero root kill
Needs numpy, scipy, ffmpeg and (for vocals) piper-tts with a voice model (set VOICE below)."""
import sys, os, hashlib, subprocess, wave, tempfile
import numpy as np
from scipy.signal import resample_poly
from scipy.io import wavfile
import synth
from synth import *

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE = os.environ.get('VOICE', os.path.join(HERE, 'voices/en_US-ryan-high.onnx'))
CACHE = os.environ.get('TTS_CACHE', os.path.join(HERE, 'tts_cache')); os.makedirs(CACHE, exist_ok=True)
PY = sys.executable
R = np.random.default_rng(42)

# ------------------------------------------------------------------ voice
def _read(path):
    sr, d = wavfile.read(path); d = d.astype(np.float32)
    if d.ndim > 1: d = d.mean(1)
    if d.dtype != np.float32 or np.abs(d).max() > 2: d = d / 32768.0
    if sr != SR: d = resample_poly(d, SR, sr)
    return d
def tts(text):
    key = hashlib.md5(text.encode()).hexdigest()[:12]; p = f'{CACHE}/{key}.wav'
    if not os.path.exists(p):
        subprocess.run([PY, '-m', 'piper', '-m', VOICE, '-f', p], input=text.encode(), check=True, capture_output=True)
    x = _read(p); x = x / (np.abs(x).max() + 1e-9)
    nz = np.where(np.abs(x) > 0.02)[0]
    return x[nz[0]: nz[-1] + 1] if len(nz) else x
def atempo(x, rate):
    chain, r = [], rate
    while r > 2.0: chain.append(2.0); r /= 2.0
    while r < 0.5: chain.append(0.5); r /= 0.5
    chain.append(r)
    with tempfile.TemporaryDirectory() as d:
        wavfile.write(f'{d}/a.wav', SR, x.astype(np.float32))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{d}/a.wav', '-af', ','.join(f'atempo={c:.4f}' for c in chain), f'{d}/b.wav'], check=True)
        return _read(f'{d}/b.wav')
def to_len(x, secs): return atempo(x, (len(x) / SR) / secs)
def robot(x, ring=55, mix=0.45, bits=9):
    t = np.arange(len(x)) / SR
    y = x * (1 - mix + mix * np.sin(2 * np.pi * ring * t))
    q = 2 ** bits; y = np.round(y * q) / q
    return lp(y, 7500)
def rapvox(x):
    y = hp(x, 110); y = y + 0.35 * hp(y, 3000); y = np.tanh(y * 2.2) * 0.9
    return y / (np.abs(y).max() + 1e-9)
def stereo_double(x, spread=0.012):
    n = len(x); d = int(spread * SR)
    L = np.concatenate([x, np.zeros(d)]); Rr = np.concatenate([np.zeros(d), x])
    return np.stack([L, Rr]) * 0.7
def put(tr, bus, x, start):
    st = x if x.ndim == 2 else np.stack([x, x]) * 0.707
    i = int(start * SR); st = st[:, : tr.n - i]
    tr.buses[bus][:, i:i + st.shape[1]] += st

# ------------------------------------------------------------------ SFX
def dtmf(digit_freqs, dur=0.08, gap=0.04):
    out = []
    for lo, hi in digit_freqs:
        n = int(dur * SR); t = np.arange(n) / SR
        out += [(np.sin(2*np.pi*lo*t) + np.sin(2*np.pi*hi*t)) * 0.4 * env(n, 0.003, 0.01, 1, 0.01), np.zeros(int(gap * SR))]
    return np.concatenate(out)
def dialup(dur=6.0):
    d = dtmf([(697, 1209), (770, 1336), (852, 1477), (941, 1209), (697, 1336), (770, 1477), (852, 1209)])
    t = np.arange(int(0.5 * SR)) / SR; a = np.sin(2*np.pi*2100*t) * 0.3
    seg = []
    for k in range(int(1.6 / 0.04)):
        n = int(0.04 * SR); f = [1200, 2400, 980, 1800][R.integers(0, 4)]; seg.append(np.sin(2*np.pi*f*np.arange(n)/SR) * 0.3)
    fsk = np.concatenate(seg)
    n = int(2.0 * SR); tt = np.arange(n) / SR
    hiss = lp(R.standard_normal(n), 3500) * 0.25 * (0.5 + 0.5 * np.sin(2*np.pi*9*tt))
    warble = np.sin(2*np.pi*(1500 + 700 * np.sin(2*np.pi*3*tt)) * tt) * 0.25
    x = np.concatenate([d, a, fsk, hiss + warble]); x = x[: int(dur * SR)]
    return x * np.linspace(1, 0.4, len(x))
def keys(dur=3.0, rate=9):
    n = int(dur * SR); x = np.zeros(n); t = 0.0
    while t < dur - 0.05:
        i = int(t * SR); m = int(0.012 * SR)
        click = hp(R.standard_normal(m), 2500) * np.exp(-np.arange(m) / (0.003 * SR)) * 0.6
        thump = np.sin(2*np.pi*140*np.arange(m)/SR) * np.exp(-np.arange(m) / (0.004 * SR)) * 0.3
        x[i:i+m] += (click + thump) * R.uniform(0.6, 1.0)
        t += R.exponential(1.0 / rate) * (0.3 if R.random() < 0.15 else 1.0) + 0.04
    return x
def beep_alert(reps=3):
    parts = []
    for r in range(reps):
        for f in (880, 660):
            n = int(0.11 * SR); parts += [lp(np.sign(np.sin(2*np.pi*f*np.arange(n)/SR)), 3000) * 0.3 * env(n, 0.003, 0.02, 1, 0.01), np.zeros(int(0.03 * SR))]
    return np.concatenate(parts)
def error_bonk():
    parts = []
    for _ in range(2):
        n = int(0.22 * SR); t = np.arange(n) / SR; f = 330 - 110 * t / 0.22
        parts += [lp(np.sign(np.sin(2*np.pi*np.cumsum(f)/SR)), 1800) * 0.35 * env(n, 0.003, 0.05, 0.8, 0.04), np.zeros(int(0.06 * SR))]
    return np.concatenate(parts)
def chime():
    n = int(1.2 * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for k, f in enumerate((784, 988, 1175, 1568)):
        i = int(k * 0.09 * SR); m = n - i; out[i:] += np.sin(2*np.pi*f*t[:m]) * np.exp(-t[:m] * 4) * 0.25
    return out
def data_burst(dur=2.0):
    n = int(dur * SR); x = np.zeros(n); pos = 0
    freqs = [440, 660, 880, 1320, 1760, 2200, 3000]
    while pos < n - 2000:
        m = int(R.integers(600, 1800)); f = freqs[R.integers(0, len(freqs))]
        x[pos:pos+m] += np.sin(2*np.pi*f*np.arange(m)/SR) * 0.2 * env(m, 0.002, 0.01, 0.8, 0.005)
        pos += m + int(R.integers(0, 900))
    return x
def glitch_sfx(dur=0.9):
    n = int(dur * SR); x = np.zeros(n); pos = 0
    while pos < n - 800:
        m = min(int(R.integers(300, 4500)), n - pos); kind = R.integers(0, 3)
        if kind == 0: seg = np.sign(np.sin(2*np.pi*R.uniform(80, 2500)*np.arange(m)/SR)) * 0.25
        elif kind == 1: seg = np.round(R.standard_normal(m) * 4) / 4 * 0.2
        else: seg = np.zeros(m)
        x[pos:pos+m] += seg; pos += m
    return x
def sweep(dur=1.5, lo=200, hi=6000, up=True):
    n = int(dur * SR); t = np.arange(n) / SR
    f = lo * (hi / lo) ** (t / dur) if up else hi * (lo / hi) ** (t / dur)
    return np.sin(2*np.pi*np.cumsum(f)/SR) * 0.25 * np.sin(np.pi * t / dur)
def boot_beeps():
    parts = []
    for f in (523, 659, 784, 1047):
        n = int(0.09 * SR); parts += [np.sin(2*np.pi*f*np.arange(n)/SR) * 0.3 * env(n, 0.003, 0.02, 0.9, 0.02), np.zeros(int(0.04 * SR))]
    return np.concatenate(parts)

def say(tr, text, bar, beat=0, drawn=False, pan=0.0, vol=0.8, bus='fx'):
    return  # voices removed: SFX only
    x = tts(text)
    if drawn:
        x = atempo(x, 0.22); x = robot(x, ring=40, mix=0.35, bits=10); x = lp(x, 3500) * env(len(x), 0.4, 0.5, 0.8, 1.2)
    else:
        x = robot(x)
    x = x / (np.abs(x).max() + 1e-9) * vol
    put(tr, bus, stereo_double(x, 0.02), tr.t(bar, beat))
    put(tr, 'fx', stereo_double(lp(x, 2500), 0.04) * 0.5, tr.t(bar, beat))

def sfx(tr, kind, bar, beat=0, vol=1.0, pan=0.0):
    x = {'dial': dialup, 'keys': keys, 'beep': beep_alert, 'bonk': error_bonk, 'chime': chime, 'data': data_burst,
         'glitch': glitch_sfx, 'sweep': sweep, 'sweepdn': lambda: sweep(2.0, 200, 6000, False), 'boot': boot_beeps}[kind]()
    tr.add('fx', x * vol, tr.t(bar, beat), pan)

PLANS = {
    'night': [('boot', 0, 0), ('keys', 1, 0), ('say', 2, 0, 'neon... grid... horizon', True), ('data', 8, 0), ('say', 12, 0, 'midnight, access granted', True),
              ('sweep', 15, 0), ('glitch', 16, 0), ('say', 24, 0, 'overdrive', True), ('dial', 28, 0)],
    'packet': [('keys', 0, 0), ('say', 4, 0, 'connection established', False), ('data', 8, 0), ('glitch', 14, 2), ('say', 15, 0, 'system breach detected', False),
               ('glitch', 16, 0), ('say', 16, 0, 'exploit successful', False), ('say', 32, 0, 'neon... cyber... electric dreams', True),
               ('sweep', 38, 0), ('bonk', 39, 2), ('say', 46, 0, 'connection terminated', False)],
    'kernel': [('bonk', 0, 0), ('keys', 2, 0), ('say', 4, 0, 'kernel panic', True), ('beep', 8, 0), ('data', 12, 0), ('glitch', 16, 0),
               ('say', 20, 0, 'root shell acquired', False), ('glitch', 28, 0), ('sweepdn', 33, 0)],
}
def run_plan(name):
    def f(tr):
        for ev in PLANS[name]:
            if ev[0] == 'say': say(tr, ev[3], ev[1], ev[2], drawn=ev[4])
            else: sfx(tr, ev[0], ev[1], ev[2], vol=0.7)
    return f

# ------------------------------------------------------------------ 808 + rap beats
def s808(midi, dur, glide=0.0):
    n = int(dur * SR); t = np.arange(n) / SR; f0 = mtof(midi)
    f = f0 * (1 + glide * np.exp(-t / 0.06))
    x = np.sin(2*np.pi*np.cumsum(f)/SR); x = np.tanh(x * 2.6) * np.exp(-t / (dur * 0.55))
    return x * env(n, 0.002, 0.02, 1.0, 0.04)
def hat_roll(tr, bar, beat, div, vol=0.4):
    for k in range(int(div)):
        tr.add('drums', hat(vol * (0.6 + 0.4 * k / div)), tr.t(bar, beat + k / div * 1.0 / 1) * 1 if False else tr.t(bar, beat) + k * tr.beat / (div / 1.0) / 1, pan=0.3)
def melody_bell(freq, n=int(0.6 * SR)):
    t = np.arange(n) / SR
    x = np.sin(2*np.pi*freq*t + 2.0 * np.sin(2*np.pi*freq*2.01*t) * np.exp(-t * 6)) * np.exp(-t * 4.5)
    return x * 0.5

def rap_track(out, cfg):
    tr = Track(cfg['bpm'], cfg['bars']); sec = cfg['sections']
    secof = lambda b: next(v for k, v in sec.items() if b in k)
    prog = cfg['prog']; mel = cfg['melody']
    for bar in range(cfg['bars']):
        s_ = secof(bar); root, ch = prog[bar % len(prog)]
        nxt = secof(bar + 1) if bar + 1 < cfg['bars'] else 'end'
        # pad / harmony
        if s_ != 'out' or bar == cfg['bars'] - 2:
            chord_pad(tr, bar, [n + 12 for n in ch], vol=cfg.get('pad', 0.17), cutoff=1800 if s_ in ('intro', 'break') else 2600)
        # bell melody
        if s_ in ('intro', 'drop', 'break', 'build'):
            for k, m in enumerate(mel[bar % len(mel)]):
                if m: tr.add('lead', melody_bell(mtof(m)) * (0.45 if s_ != 'break' else 0.6), tr.t(bar, k * 0.5), pan=-0.3 + 0.6 * (k % 2))
        if s_ == 'drop':
            for b in cfg['kicks']:
                tr.add('drums', kick(1.0), tr.t(bar, b)); tr.kicks.append(tr.t(bar, b))
                if cfg['bass'] == '808':
                    tr.add('bass', s808(root - 12 + cfg.get('oct', 0), tr.beat * cfg.get('dur808', 1.2), glide=cfg.get('glide', 0.25)) * 0.8, tr.t(bar, b))
            if cfg['bass'] == 'boom':
                for e in range(8):
                    f = mtof(root - 12); n = int(0.22 * SR)
                    tr.add('bass', lp(saw(f, n), 300) * env(n, 0.004, 0.1, 0.5, 0.06) * 0.6, tr.t(bar, e * 0.5))
            for b in cfg['snares']:
                tr.add('drums', snare(0.9, 180), tr.t(bar, b)); tr.add('drums', clap(0.8), tr.t(bar, b)); tr.add('fx', snare(0.5), tr.t(bar, b))
            style = cfg['hats']
            if style == 'trap':
                for e in range(8): tr.add('drums', hat(0.45 + 0.15 * (e % 2)), tr.t(bar, e * 0.5), pan=0.3)
                if bar % 2 == 1:
                    for k in range(6): tr.add('drums', hat(0.35 + 0.05 * k), tr.t(bar, 3.0 + k * 0.1667), pan=0.3)
            elif style == 'drill':
                for b in (0.5, 1.5, 2.0, 2.5, 3.25, 3.75): tr.add('drums', hat(0.5), tr.t(bar, b), pan=0.3)
                if bar % 2 == 1:
                    for k in range(4): tr.add('drums', hat(0.4), tr.t(bar, 3.0 + k * 0.25), pan=0.3)
            else:
                for e in range(8): tr.add('drums', hat(0.4 if e % 2 else 0.25), tr.t(bar, e * 0.5), pan=0.3)
            if bar % 4 == 0: tr.add('fx', kick(1.4) * 0.6, tr.t(bar, 0))
        if s_ == 'build':
            nb = [b for b in range(cfg['bars']) if secof(b) == 'build'][-1]
            last = (bar == nb)
            idx = bar - [b for b in range(cfg['bars']) if secof(b) == 'build'][0]
            div = [1, 2, 4, 8][min(idx, 3)] if last or idx >= 1 else 1
            for k in range(int(4 * div) - (1 if last else 0)):
                if last and k / div >= 3.5: break
                tr.add('drums', snare(0.3 + 0.08 * idx), tr.t(bar, k / div))
            if idx == 0 or last: tr.add('fx', riser(tr.beat * 4 * (2 if idx == 0 else 1)), tr.t(bar, 0))
            if bar > [b for b in range(cfg['bars']) if secof(b) == 'build'][0] - 1:
                for b in (0, 2): tr.add('drums', kick(0.9), tr.t(bar, b)); tr.kicks.append(tr.t(bar, b))
        if s_ == 'break':
            for b in (1, 3): tr.add('drums', clap(0.5), tr.t(bar, b))
        if s_ == 'out' and bar == cfg['bars'] - 2:
            tr.add('bass', s808(root - 12, tr.beat * 4, 0.1) * 0.8, tr.t(bar, 0))
    synth.EXTRA = cfg['extra'](tr) if False else None
    if cfg.get('extra'): synth.EXTRA = cfg['extra']
    finish(tr, out, {'pad': 0.5, 'lead': 0.45, 'fx': 0.4}, ['bass', 'pad'], cfg.get('sc', 0.5), delay_time=tr.beat * 0.75)

def vox_line(tr, text, bar, bars_len=1, beat=0.0, gain=0.9):
    return
    x = tts(text); x = to_len(x, tr.beat * 4 * bars_len * 0.92); x = rapvox(x) * gain
    put(tr, 'lead', stereo_double(x, 0.011), tr.t(bar, beat))

def chant(tr, text, bar, bars_len=1, gain=0.8, down=False):
    return
    x = tts(text); x = to_len(x, tr.beat * 4 * bars_len * 0.95); x = robot(x, 60, 0.3, 10) * gain
    put(tr, 'lead', stereo_double(x, 0.02), tr.t(bar, 0)); put(tr, 'fx', stereo_double(lp(x, 2200), 0.05) * 0.6, tr.t(bar, 0))

SEC_STD = lambda: {range(0, 4): 'intro', range(4, 8): 'build', range(8, 24): 'drop', range(24, 28): 'break', range(28, 32): 'build', range(32, 48): 'drop', range(48, 52): 'out'}

def extra_for(events):
    def f(tr):
        for ev in events:
            if ev[0] == 'say': say(tr, ev[3], ev[1], ev[2], drawn=ev[4])
            elif ev[0] == 'chant': chant(tr, ev[3], ev[1], ev[2])
            elif ev[0] == 'line': vox_line(tr, ev[3], ev[1], 1)
            else: sfx(tr, ev[0], ev[1], ev[2], vol=0.7)
    return f

def zero_day(out):
    cfg = dict(bpm=140, bars=52, sections=SEC_STD(), root=36, bass='808', kicks=[0, 0.75, 2.25, 3.5], snares=[2], hats='trap', glide=0.3, dur808=1.0, sc=0.45,
               prog=[(36, [48, 51, 55]), (32, [44, 48, 51]), (31, [43, 46, 50]), (34, [46, 50, 53])],
               melody=[[75, 0, 72, 0, 70, 0, 72, 0], [75, 0, 72, 0, 68, 0, 70, 0], [74, 0, 71, 0, 70, 0, 67, 0], [74, 0, 72, 0, 70, 0, 0, 0]])
    cfg['extra'] = extra_for([('keys', 0, 0), ('boot', 1, 0), ('say', 2, 0, 'zero day', True), ('data', 5, 0), ('say', 7, 2, 'zero day', False),
                              ('say', 12, 0, 'exploit successful', False), ('glitch', 23, 3), ('say', 24, 0, 'unpatched... undetected', True), ('sweep', 27, 0),
                              ('say', 31, 2, 'zero day', False), ('glitch', 40, 0), ('bonk', 47, 3), ('dial', 48, 0)])
    rap_track(out, cfg)
def root_access(out):
    cfg = dict(bpm=92, bars=48, sections={range(0, 4): 'intro', range(4, 8): 'build', range(8, 24): 'drop', range(24, 28): 'break', range(28, 32): 'build', range(32, 44): 'drop', range(44, 48): 'out'},
               bass='boom', kicks=[0, 1.5, 2.5], snares=[1, 3], hats='boom', sc=0.35, pad=0.14,
               prog=[(45, [57, 60, 64]), (45, [57, 60, 64]), (41, [53, 57, 60]), (43, [55, 59, 62])],
               melody=[[69, 0, 0, 72, 0, 71, 0, 0], [69, 0, 0, 72, 0, 74, 0, 0], [65, 0, 0, 69, 0, 67, 0, 0], [67, 0, 0, 71, 0, 72, 0, 0]])
    cfg['extra'] = extra_for([('keys', 0, 0), ('say', 2, 0, 'root access', True), ('beep', 6, 0), ('say', 7, 2, 'access granted', False), ('data', 12, 0),
                              ('glitch', 23, 3), ('say', 24, 0, 'sudo... root... midnight', True), ('chime', 27, 0), ('glitch', 31, 3), ('bonk', 40, 0), ('dial', 44, 0)])
    rap_track(out, cfg)
def kill_chain(out):
    cfg = dict(bpm=144, bars=52, sections=SEC_STD(), bass='808', kicks=[0, 1.75, 2.5, 3.25], snares=[2], hats='drill', glide=0.5, dur808=0.8, sc=0.5, oct=0,
               prog=[(33, [45, 48, 52]), (33, [45, 48, 52]), (29, [41, 45, 48]), (31, [43, 47, 50])],
               melody=[[81, 0, 0, 79, 0, 0, 76, 0], [81, 0, 0, 79, 0, 0, 77, 0], [77, 0, 0, 76, 0, 0, 72, 0], [79, 0, 0, 77, 0, 0, 76, 0]])
    cfg['extra'] = extra_for([('boot', 0, 0), ('say', 2, 0, 'kill chain', True), ('data', 5, 0), ('say', 7, 2, 'recon... weaponize... deliver', False), ('beep', 12, 0),
                              ('glitch', 23, 3), ('say', 24, 0, 'exploit... install... command and control', True), ('sweep', 27, 0), ('say', 31, 2, 'actions on objective', False),
                              ('glitch', 40, 0), ('keys', 47, 0), ('dial', 48, 0)])
    rap_track(out, cfg)

if __name__ == '__main__':
    name, out = sys.argv[1], sys.argv[2]
    if name in PLANS:
        import synth as S
        S.EXTRA = run_plan(name)
        {'night': S.night_shift, 'packet': S.packet_loss, 'kernel': S.kernel_panic}[name](out)
    else:
        {'zero': zero_day, 'root': root_access, 'kill': kill_chain}[name](out)
