// Deterministic trig. ECMAScript only pins down + - * / and sqrt to IEEE-754 correctly rounded results;
// Math.sin/cos/atan2 differ between V8, JavaScriptCore and SpiderMonkey. The physics uses these instead so the
// same (spec, seed) gives the same run on every browser. Kernels and constants are from fdlibm.

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
const HALF_PI = 1.5707963267948966;

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_1T = 6.07710050650619224932e-11;

function kSin(x: number): number {
  const z = x * x;
  return x + x * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))));
}

function kCos(x: number): number {
  const z = x * x;
  return 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
}

/** Reduces x to [-pi/4, pi/4]; returns the quadrant in `q` via the out array. Fine for |x| < 1e6. */
function reduce(x: number, out: number[]): number {
  const n = Math.floor(x * INV_PIO2 + 0.5);
  out[0] = ((n % 4) + 4) % 4;
  return x - n * PIO2_1 - n * PIO2_1T;
}

const quad = [0];

export function dsin(x: number): number {
  const y = reduce(x, quad);
  switch (quad[0]) {
    case 0: return kSin(y);
    case 1: return kCos(y);
    case 2: return -kSin(y);
    default: return -kCos(y);
  }
}

export function dcos(x: number): number {
  const y = reduce(x, quad);
  switch (quad[0]) {
    case 0: return kCos(y);
    case 1: return -kSin(y);
    case 2: return -kCos(y);
    default: return kSin(y);
  }
}

const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.11111104054623557880e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.65315727442169155270e-2, 1.62858201153657823623e-2,
];
const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];

export function datan(x0: number): number {
  const neg = x0 < 0;
  let x = neg ? -x0 : x0;
  let id: number;
  if (x < 0.4375) id = -1;
  else if (x < 0.6875) { id = 0; x = (2 * x - 1) / (2 + x); }
  else if (x < 1.1875) { id = 1; x = (x - 1) / (x + 1); }
  else if (x < 2.4375) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); }
  else { id = 3; x = -1 / x; }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  let r: number;
  if (id < 0) r = x - x * (s1 + s2);
  else r = ATAN_HI[id] - ((x * (s1 + s2) - ATAN_LO[id]) - x);
  return neg ? -r : r;
}

export function datan2(y: number, x: number): number {
  if (x === 0) {
    if (y > 0) return HALF_PI;
    if (y < 0) return -HALF_PI;
    return 0;
  }
  const a = datan(y / x);
  if (x > 0) return a;
  return y >= 0 ? a + PI : a - PI;
}

/** Wraps an angle to [-pi, pi). */
export function wrapAngle(a: number): number {
  while (a >= PI) a -= TAU;
  while (a < -PI) a += TAU;
  return a;
}

export const DEG = PI / 180;
