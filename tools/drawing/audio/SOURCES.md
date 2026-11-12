# Pencil recording

- Work: **Scribble** by **Tomoyo Ichijouji**, Freesound sound 211247.
- Source page: https://freesound.org/people/Tomoyo%20Ichijouji/sounds/211247/
- Source public HQ preview: https://cdn.freesound.org/previews/211/211247_1506161-hq.mp3
- License: **CC0 1.0 Universal**, https://creativecommons.org/publicdomain/zero/1.0/
- Accessed: 2026-11-10. The source page identifies a recording of a 0.5 mm
  mechanical pencil scribbling on stiff printer paper, licensed CC0.

The original 1.184-second preview was decoded to mono 24 kHz, trimmed to
0.01–1.10 seconds, DC-centred, normalised to RMS 0.10, and given 8 ms fades
at both ends. No synthesised noise was mixed in. The processed 1.09-second
PCM16 little-endian recording is `src/topics/renderers/drawing/pencil-writing.pcm`.
`pencilRecording.js` embeds it in the topic renderer and main fallback bundle;
there are no runtime downloads, external URLs or per-step sound files.
The player's motion envelope supplies quiet volume and silence between steps.

Original source files are not redistributed in the repository. Attribution is
retained here for provenance even though CC0 does not require it.
