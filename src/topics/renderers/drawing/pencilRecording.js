import recording from './pencil-writing.pcm?url&inline';

// Recorded pencil on printer paper (CC0, Tomoyo Ichijouji / Freesound 211247).
// 24 kHz mono signed PCM16 little-endian, embedded in the renderer for offline
// use. Build an AudioBuffer synchronously: no fetch/decoder delay on iOS's
// first user gesture. Source, license and processing: tools/drawing/audio/SOURCES.md.
export function createPencilRecordingBuffer(context) {
  const bytes = atob(recording.slice(recording.indexOf(',')+1));
  const buffer = context.createBuffer(1, bytes.length/2, 24000);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const sample = bytes.charCodeAt(i*2) | bytes.charCodeAt(i*2+1) << 8;
    data[i] = (sample > 32767 ? sample-65536 : sample)/32768;
  }
  return buffer;
}
