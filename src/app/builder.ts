// The sandbox: pick a kind, colors or countries, and the knobs that kind has, then play it. Up to SANDBOX_SLOTS
// sims can be saved on the device.

import { MELODIES } from '../audio/melodies';
import { flagCss } from '../render/flags';
import {
  COLORS, COLOR_NAMES, COUNTRIES, KINDS, type Kind, type MelodyId, type Spec, defaultTitle, isContest,
  shortCountryName, withDefaults,
} from '../sim/spec';
import { SANDBOX_SLOTS, deleteSim, saveSim, store } from './store';

type NumKey = 'rings' | 'gap_deg' | 'spin' | 'grow' | 'cap' | 'size' | 'gravity';
type Knob = { key: NumKey; label: (k: Kind) => string; min: (k: Kind) => number; max: number; step: number; unit: string; kinds: Kind[] };

const KNOBS: Knob[] = [
  { key: 'rings', label: () => 'Rings', min: () => 1, max: 8, step: 1, unit: '', kinds: ['escape'] },
  { key: 'gap_deg', label: () => 'Gap size', min: () => 10, max: 90, step: 1, unit: '°', kinds: ['escape', 'battle'] },
  {
    key: 'spin', label: () => 'Spin', min: () => -180, max: 180, step: 5, unit: '°/s',
    kinds: ['escape', 'battle', 'grow', 'multiply', 'blocks'],
  },
  {
    key: 'grow', label: () => 'Grow per bounce', min: (k) => (k === 'grow' ? 0.5 : 0), max: 4, step: 0.1, unit: ' px',
    kinds: ['escape', 'grow'],
  },
  { key: 'cap', label: () => 'Stop at', min: () => 20, max: 250, step: 10, unit: ' balls', kinds: ['multiply'] },
  { key: 'size', label: () => 'Ball size', min: () => 0.6, max: 1.6, step: 0.1, unit: 'x', kinds: [...KINDS] },
  {
    key: 'gravity', label: (k) => (k === 'orbit' ? 'Black hole pull' : 'Gravity'),
    min: (k) => (k === 'race' || k === 'orbit' ? 0.5 : 0), max: 2, step: 0.1, unit: 'x',
    kinds: ['escape', 'battle', 'grow', 'multiply', 'race', 'orbit'],
  },
];

const KIND_INFO: Record<Kind, string> = {
  escape: 'Escape the rings',
  battle: 'Last one inside wins',
  grow: 'Grows every bounce',
  multiply: 'Every bounce adds a ball',
  race: 'Marble race',
  orbit: 'Black hole survival',
  blocks: 'Break every block',
};

export type BuildResult = { spec: Spec; fit: boolean };

const DEFAULT_COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
const DEFAULT_COUNTRIES = ['us', 'br', 'jp', 'de', 'in', 'mx'];

let draft: Spec = { kind: 'battle', seed: 0, melody: 'canon', colors: [...DEFAULT_COLORS] };
let useCountries = false;
let fit = true;
let query = '';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function fmt(v: number, step: number): string {
  return step < 1 ? v.toFixed(1) : String(Math.round(v));
}

/** Keeps only the fields the kind uses, so share links and saved sims stay small. */
export function tidySpec(spec: Spec): Spec {
  const out: Spec = { kind: spec.kind, seed: spec.seed, melody: spec.melody };
  for (const knob of KNOBS) {
    const v = spec[knob.key];
    if (knob.kinds.includes(spec.kind) && v !== undefined) out[knob.key] = v;
  }
  if (isContest(spec.kind)) {
    if (spec.countries?.length) out.countries = [...spec.countries];
    else out.colors = [...(spec.colors?.length ? spec.colors : DEFAULT_COLORS)];
  }
  return out;
}

export function openBuilder(root: HTMLElement, initial: Spec | null, onPlay: (r: BuildResult) => void, onClose: () => void): void {
  if (initial) {
    draft = { ...initial };
    useCountries = Boolean(initial.countries?.length);
  }
  const render = (): void => {
    root.replaceChildren(header(), kindSection(), contestSection(), knobSection(), melodySection(), actions(), savedSection());
  };

  const header = () => {
    const h = el('div', 'panel-head');
    h.append(el('h2', '', 'Build your own'));
    const close = el('button', 'icon', '✕');
    close.setAttribute('aria-label', 'Close');
    close.onclick = onClose;
    h.append(close);
    return h;
  };

  const kindSection = () => {
    const sec = el('section', 'panel-sec');
    sec.append(el('h3', '', 'Kind'));
    const grid = el('div', 'kinds');
    for (const k of KINDS) {
      const b = el('button', `kind${draft.kind === k ? ' on' : ''}`);
      b.append(el('b', '', k.toUpperCase()), el('span', '', KIND_INFO[k]));
      b.onclick = () => {
        draft = tidySpec({ ...draft, kind: k });
        if (isContest(k) && !draft.colors && !draft.countries) draft.colors = [...DEFAULT_COLORS];
        render();
      };
      grid.append(b);
    }
    sec.append(grid);
    return sec;
  };

  const contestSection = () => {
    const sec = el('section', 'panel-sec');
    if (!isContest(draft.kind)) {
      sec.hidden = true;
      return sec;
    }
    const seg = el('div', 'seg');
    for (const [label, flags] of [['Colors', false], ['Countries', true]] as const) {
      const b = el('button', useCountries === flags ? 'on' : '', label);
      b.onclick = () => {
        useCountries = flags;
        if (flags) {
          draft.countries = draft.countries?.length ? draft.countries : [...DEFAULT_COUNTRIES];
          delete draft.colors;
        } else {
          draft.colors = draft.colors?.length ? draft.colors : [...DEFAULT_COLORS];
          delete draft.countries;
        }
        render();
      };
      seg.append(b);
    }
    sec.append(el('h3', '', 'Who plays'), seg);
    if (!useCountries) {
      const grid = el('div', 'chips');
      const chosen = draft.colors ?? [];
      for (const c of COLOR_NAMES) {
        const on = chosen.includes(c);
        const b = el('button', `chip-btn${on ? ' on' : ''}`);
        b.style.setProperty('--c', COLORS[c]);
        b.append(el('span', 'dot'), c.toUpperCase());
        b.onclick = () => {
          if (on && chosen.length <= 2) return;
          draft.colors = on ? chosen.filter((x) => x !== c) : [...chosen, c].slice(0, 10);
          render();
        };
        grid.append(b);
      }
      sec.append(grid, el('p', 'hint', `${chosen.length} colors · 2 to 10`));
    } else {
      const chosen = draft.countries ?? [];
      const picked = el('div', 'chips');
      for (const code of chosen) {
        const b = el('button', 'chip-btn on');
        const f = el('span', 'flag');
        f.style.cssText = flagCss(code);
        b.append(f, `${shortCountryName(code)} ✕`);
        b.onclick = () => {
          if (chosen.length <= 2) return;
          draft.countries = chosen.filter((x) => x !== code);
          render();
        };
        picked.append(b);
      }
      const search = el('input', 'search');
      search.type = 'search';
      search.placeholder = `Search ${Object.keys(COUNTRIES).length} countries`;
      search.value = query;
      const results = el('div', 'chips results');
      const fill = () => {
        const q = query.trim().toLowerCase();
        const matches = Object.entries(COUNTRIES)
          .filter(([code, name]) => !chosen.includes(code) && (!q || name.toLowerCase().includes(q) || code === q))
          .slice(0, 18);
        results.replaceChildren(
          ...matches.map(([code]) => {
            const b = el('button', 'chip-btn');
            const f = el('span', 'flag');
            f.style.cssText = flagCss(code);
            b.append(f, shortCountryName(code));
            b.disabled = chosen.length >= 12;
            b.onclick = () => {
              draft.countries = [...chosen, code];
              render();
            };
            return b;
          }),
        );
      };
      search.oninput = () => {
        query = search.value;
        fill();
      };
      fill();
      sec.append(picked, el('p', 'hint', `${chosen.length} countries · 2 to 12`), search, results);
    }
    return sec;
  };

  const knobSection = () => {
    const sec = el('section', 'panel-sec');
    sec.append(el('h3', '', 'Settings'));
    const d = withDefaults(draft);
    for (const knob of KNOBS) {
      if (!knob.kinds.includes(draft.kind)) continue;
      const row = el('label', 'knob');
      const value = el('output');
      const input = el('input');
      input.type = 'range';
      input.min = String(knob.min(draft.kind));
      input.max = String(knob.max);
      input.step = String(knob.step);
      input.value = String(d[knob.key]);
      value.textContent = `${fmt(Number(input.value), knob.step)}${knob.unit}`;
      input.oninput = () => {
        const v = Number(input.value);
        draft[knob.key] = v;
        value.textContent = `${fmt(v, knob.step)}${knob.unit}`;
      };
      const top = el('span', 'knob-top');
      top.append(el('span', '', knob.label(draft.kind)), value);
      row.append(top, input);
      sec.append(row);
    }
    return sec;
  };

  const melodySection = () => {
    const sec = el('section', 'panel-sec');
    sec.append(el('h3', '', 'Melody'));
    const select = el('select', 'select');
    for (const [id, m] of Object.entries(MELODIES)) {
      const o = el('option', '', m.name);
      o.value = id;
      o.selected = id === draft.melody;
      select.append(o);
    }
    select.onchange = () => (draft.melody = select.value as MelodyId);
    const fitRow = el('label', 'toggle');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = fit;
    box.onchange = () => (fit = box.checked);
    const [lo, hi] = withDefaults(draft).target_seconds;
    fitRow.append(box, `Find a run that lasts ${lo}–${hi} s`);
    sec.append(select, fitRow);
    return sec;
  };

  const actions = () => {
    const row = el('div', 'panel-actions');
    const save = el('button', 'btn ghost', `Save (${store.sims.length}/${SANDBOX_SLOTS})`);
    save.disabled = store.sims.length >= SANDBOX_SLOTS;
    save.onclick = () => {
      if (saveSim(tidySpec(draft))) render();
    };
    const play = el('button', 'btn primary', '▶ Play');
    play.onclick = () => onPlay({ spec: tidySpec(draft), fit });
    row.append(save, play);
    return row;
  };

  const savedSection = () => {
    const sec = el('section', 'panel-sec');
    if (!store.sims.length) {
      sec.hidden = true;
      return sec;
    }
    sec.append(el('h3', '', 'Saved sims'));
    store.sims.forEach((saved, i) => {
      const row = el('div', 'saved');
      const name = el('button', 'saved-name', `${saved.spec.kind.toUpperCase()} · ${defaultTitle(saved.spec).replace('\n', ' ')}`);
      name.onclick = () => {
        draft = { ...saved.spec };
        useCountries = Boolean(saved.spec.countries?.length);
        render();
      };
      const del = el('button', 'icon small', '✕');
      del.setAttribute('aria-label', 'Delete saved sim');
      del.onclick = () => {
        deleteSim(i);
        render();
      };
      row.append(name, del);
      sec.append(row);
    });
    return sec;
  };

  render();
}
