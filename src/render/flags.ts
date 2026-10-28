// Flag images for country balls, loaded on demand from public/flags (128 px squares, clipped to a circle).

const images = new Map<string, HTMLImageElement>();

export function flagUrl(code: string): string {
  return `${import.meta.env.BASE_URL}flags/${code}.png`;
}

/** Starts loading flags; resolves when all have loaded (or failed). */
export function preloadFlags(codes: string[]): Promise<void> {
  return Promise.all(
    codes.map((code) => {
      const existing = images.get(code);
      if (existing?.complete) return Promise.resolve();
      const img = existing ?? new Image();
      if (!existing) {
        img.decoding = 'async';
        img.src = flagUrl(code);
        images.set(code, img);
      }
      return new Promise<void>((done) => {
        img.addEventListener('load', () => done(), { once: true });
        img.addEventListener('error', () => done(), { once: true });
      });
    }),
  ).then(() => undefined);
}

export function flagImage(code: string): HTMLImageElement | null {
  const img = images.get(code);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}
