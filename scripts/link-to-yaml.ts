// For the channel's sessions: turns a viewer's share link into an orbit.py-style spec.
// npx vite-node scripts/link-to-yaml.ts "<share link>" ["credit name"]
import { specToYaml } from '../src/app/submit';
import { paramsToSpec } from '../src/sim/spec';

const [link, credit = ''] = process.argv.slice(2);
if (!link) {
  console.error('usage: link-to-yaml.ts "<share link>" ["credit name"]');
  process.exit(1);
}
const spec = paramsToSpec(new URL(link).searchParams);
if (!spec) {
  console.error('Not an Orbit Arena sim link');
  process.exit(1);
}
process.stdout.write(specToYaml(spec, credit, link));
