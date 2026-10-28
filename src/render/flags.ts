// Country flags come from one sprite sheet (src/assets/flags/atlas.webp, 96 px square cells) so the app makes a
// single request on the web and the iOS build can inline it.

import atlasUrl from '../assets/flags/atlas.webp';
import index from '../data/flag-index.json';

const cellOf = new Map(index.codes.map((code, i) => [code, i] as const));
let atlas: HTMLImageElement | null = null;
let loading: Promise<void> | null = null;

export type FlagSprite = { img: HTMLImageElement; sx: number; sy: number; size: number };

export function preloadFlags(): Promise<void> {
  if (!loading) {
    loading = new Promise((done) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { atlas = img; done(); };
      img.onerror = () => done();
      img.src = atlasUrl;
    });
  }
  return loading;
}

export function flagSprite(code: string): FlagSprite | null {
  const i = cellOf.get(code);
  if (!atlas || i === undefined) return null;
  return { img: atlas, sx: (i % index.cols) * index.cell, sy: Math.floor(i / index.cols) * index.cell, size: index.cell };
}

/** CSS for showing one flag from the sheet as a background (pick chips). */
export function flagCss(code: string): string {
  const i = cellOf.get(code) ?? 0;
  const col = i % index.cols;
  const row = Math.floor(i / index.cols);
  const x = (col / (index.cols - 1)) * 100;
  const y = (row / (index.rows - 1)) * 100;
  return `background-image:url("${atlasUrl}");background-size:${index.cols * 100}% ${index.rows * 100}%;background-position:${x}% ${y}%`;
}
