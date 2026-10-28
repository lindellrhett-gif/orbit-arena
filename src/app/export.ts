// Video export: the sim is replayed onto a 720x1280 canvas with the watermark, and that canvas plus the synth's
// audio are recorded together with MediaRecorder. Where recording isn't available, the fallback is a picture of
// the result plus the share link.

import { isNative, sendFile } from './platform';

/** Formats in order of preference: MP4 posts everywhere (TikTok, Shorts, Reels); WebM is the Firefox fallback. */
const MIME_TYPES = [
  'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export const EXPORT_WIDTH = 720;

export function recordingMime(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    return null;
  }
  return MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export class VideoRecorder {
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  readonly mime: string;

  constructor(canvas: HTMLCanvasElement, audio: MediaStream | null, mime: string) {
    this.mime = mime;
    const stream = canvas.captureStream(60);
    for (const track of audio?.getAudioTracks() ?? []) stream.addTrack(track);
    this.recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(500);
  }

  stop(): Promise<Blob> {
    return new Promise((done) => {
      this.recorder.onstop = () => done(new Blob(this.chunks, { type: this.mime.split(';')[0] }));
      this.recorder.stop();
    });
  }

  cancel(): void {
    this.recorder.onstop = null;
    if (this.recorder.state !== 'inactive') this.recorder.stop();
  }
}

/** Hands a finished file to the user: the share sheet where it can take files, otherwise a download. */
export async function deliverFile(blob: Blob, name: string): Promise<'shared' | 'saved' | 'failed'> {
  if (isNative) {
    await sendFile(blob, name);
    return 'shared';
  }
  const file = new File([blob], name, { type: blob.type });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return 'shared';
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return 'shared';
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

export function fileExtension(mime: string): string {
  return mime.startsWith('video/mp4') ? 'mp4' : mime.startsWith('video/webm') ? 'webm' : 'png';
}
