// Ball skins and trail effects (the Skins & Trails unlock). Drawing only: they never touch the physics, every skin
// keeps the team color readable, and each viewer sees their own choice, so share links don't carry them.

export const SKINS = [
  { id: 'classic', name: 'Classic' },
  { id: 'glossy', name: 'Glossy' },
  { id: 'neon', name: 'Neon' },
  { id: 'planet', name: 'Planet' },
] as const;

export const TRAILS = [
  { id: 'classic', name: 'Classic' },
  { id: 'comet', name: 'Comet' },
  { id: 'rainbow', name: 'Rainbow' },
  { id: 'sparkle', name: 'Sparkle' },
] as const;

export type SkinId = (typeof SKINS)[number]['id'];
export type TrailId = (typeof TRAILS)[number]['id'];
export type Look = { skin: SkinId; trail: TrailId };

export const CLASSIC: Look = { skin: 'classic', trail: 'classic' };

/** Falls back to the classic look for unknown ids (a save from a newer version, say). */
export function cleanLook(skin: string, trail: string): Look {
  return {
    skin: SKINS.some((s) => s.id === skin) ? (skin as SkinId) : 'classic',
    trail: TRAILS.some((t) => t.id === trail) ? (trail as TrailId) : 'classic',
  };
}
