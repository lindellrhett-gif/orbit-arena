// "Submit your sim to Orbit Arena": turns a sim into a spec in the channel renderer's YAML format (scripts/orbit.py)
// plus a credit name. The app sends nothing anywhere: the viewer copies the link or YAML and posts it (a comment
// on a Short, or a DM), and the channel's sessions render the best ones with credit.

import { type Spec, withDefaults } from '../sim/spec';
import { defaultTitle } from '../sim/spec';

/** Credit names: letters, numbers, spaces and _ . @ - only, 24 characters max. */
export function cleanCredit(name: string): string {
  return name.normalize('NFC').replace(/[^\p{L}\p{N} _.@-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

const list = (xs: string[]) => `[${xs.join(', ')}]`;

/**
 * orbit.py-style spec. There's no `seed`: the app's physics isn't orbit.py's, so the renderer picks its own seed
 * with --dry (as the playbook does for every post). `app_link` replays the exact app run for reference.
 */
export function specToYaml(spec: Spec, credit: string, link: string): string {
  const s = withDefaults(spec);
  const lines = [
    '# Orbit Arena sim made in the app',
    `kind: ${spec.kind}`,
    `title: ${JSON.stringify(defaultTitle(spec).replace(/\n/g, ' '))}`,
    `melody: ${spec.melody}`,
    `target_seconds: ${list(s.target_seconds.map(String))}`,
  ];
  if (spec.countries?.length) lines.push(`countries: ${list(spec.countries)}`);
  else if (spec.colors?.length) lines.push(`colors: ${list(spec.colors)}`);
  if (spec.kind === 'escape') lines.push(`rings: ${s.rings}`);
  if (spec.kind === 'escape' || spec.kind === 'battle') lines.push(`gap_deg: ${s.gap_deg}`);
  if (['escape', 'battle', 'grow', 'multiply', 'blocks'].includes(spec.kind)) lines.push(`spin: ${s.spin}`);
  if (s.grow) lines.push(`grow: ${s.grow}`);
  if (spec.kind === 'multiply') lines.push(`cap: ${s.cap}`);
  if (s.gravity !== 1) lines.push(`gravity: ${s.gravity}`);
  if (s.size !== 1) lines.push(`size: ${s.size}`);
  const who = cleanCredit(credit);
  if (who) lines.push(`credit: ${JSON.stringify(who)}`);
  lines.push(`app_link: ${JSON.stringify(link)}`);
  return lines.join('\n') + '\n';
}
