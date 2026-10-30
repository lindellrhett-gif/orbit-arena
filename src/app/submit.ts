// "Submit your sim to Orbit Arena": turns a sim into a spec in the channel renderer's YAML format (scripts/orbit.py)
// plus a credit name. The app sends nothing anywhere: the viewer copies the link or YAML and posts it (a comment
// on a Short, or a DM), and the channel's sessions render the best ones with credit.

import { type Kind, type Spec, withDefaults } from '../sim/spec';
import { defaultTitle } from '../sim/spec';

/** Credit names: letters, numbers, spaces and _ . @ - only, 24 characters max. */
export function cleanCredit(name: string): string {
  return name.normalize('NFC').replace(/[^\p{L}\p{N} _.@-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

const list = (xs: string[]) => `[${xs.join(', ')}]`;
const round2 = (x: number) => Math.round(x * 100) / 100;

// orbit.py's own values, for turning the app's multipliers into its absolute units.
const GRAVITY: Partial<Record<Kind, number>> = { escape: 1500, battle: 1500, grow: 1500, multiply: 1500, race: 900 };
const ORBIT_PULL = 26_000_000; // written as an integer: PyYAML reads 2.6e7 as a string

/** orbit.py's default ball radius, for kinds whose spec takes `ball_r` (grow and multiply have fixed sizes). */
function ballR(spec: Spec, rings: number): number | undefined {
  switch (spec.kind) {
    case 'escape':
      return rings > 1 ? 22 : 26;
    case 'battle':
      return spec.countries?.length ? 40 : 34;
    case 'race':
      return 20;
    case 'orbit':
      return 22;
    case 'blocks':
      return 14;
    default:
      return undefined;
  }
}

/**
 * orbit.py spec, laid out like the channel's own sim.yaml files. There's no `seed`: the app's physics isn't
 * orbit.py's, so the renderer picks its own with --dry (as the playbook does for every post). Knobs orbit.py can't
 * express (spin for grow, multiply and blocks; ball size for grow and multiply) are left out. `credit` and
 * `app_link` are extra keys orbit.py ignores; `app_link` replays the exact app run for reference.
 */
export function specToYaml(spec: Spec, credit: string, link: string): string {
  const s = withDefaults(spec);
  const lines = [
    '# Orbit Arena sim made in the app',
    `kind: ${spec.kind}`,
    `title: ${JSON.stringify(defaultTitle(spec))}`,
    `melody: ${spec.melody}`,
  ];
  if (spec.countries?.length) lines.push(`countries: ${list(spec.countries)}`);
  else if (spec.colors?.length) lines.push(`colors: ${list(spec.colors)}`);
  const spin = `spin: ${round2((s.spin * Math.PI) / 180)}`; // the app's spin is degrees per second, orbit.py's radians
  switch (spec.kind) {
    case 'escape':
      lines.push(`rings: ${s.rings}`, `gap_deg: ${s.gap_deg}`, spin);
      if (s.grow) lines.push(`grow: ${s.grow}`);
      break;
    case 'battle':
      lines.push(`gap_deg: ${s.gap_deg}`, spin);
      break;
    case 'grow':
      lines.push(`grow: ${s.grow}`);
      break;
    case 'multiply':
      lines.push(`cap: ${s.cap}`);
      break;
    case 'race':
      lines.push('ramps: 5', 'paddles: 2', 'bumps: 1');
      break;
    case 'blocks':
      lines.push('field_r: 290', 'block: 34', 'speed: 950', 'split_every: 15', 'max_balls: 6');
      break;
  }
  const g = GRAVITY[spec.kind];
  if (s.gravity !== 1 && spec.kind === 'orbit') lines.push(`pull: ${Math.round(ORBIT_PULL * s.gravity)}`);
  else if (s.gravity !== 1 && g) lines.push(`gravity: ${Math.round(g * s.gravity)}`);
  const r = ballR(spec, s.rings);
  if (s.size !== 1 && r) lines.push(`ball_r: ${Math.round(r * s.size)}`);
  lines.push(`target_seconds: ${list(s.target_seconds.map(String))}`, 'out: video.mp4');
  const who = cleanCredit(credit);
  if (who) lines.push(`credit: ${JSON.stringify(who)}`);
  lines.push(`app_link: ${JSON.stringify(link)}`);
  return lines.join('\n') + '\n';
}
