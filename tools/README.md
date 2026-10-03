Track generator for the /music page (synth.py = instruments + three synth tracks, synth2.py = hacker SFX and rap beats).
Setup: python -m venv venv && venv/bin/pip install numpy scipy   (needs ffmpeg)
Run:   venv/bin/python tools/synth2.py <night|packet|kernel|zero|root|kill> out/name   then encode the .wav with ffmpeg.

Nightcore set (180-220 BPM): venv/bin/python tools/synth3.py <overdrive|hyperlink|rooftop|nightdrive|finalboss> out/name, then encode. The mix is the five tracks joined with ffmpeg acrossfade.
