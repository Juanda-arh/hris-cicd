// Import of the "Organization & Leveling Framework" HTML (MS_Systems_Org_Framework_ALL.html).
// Only the content is read — text and the data arrays of each tab. The HTML is never rendered and
// its scripts never run. It replaces the tabs from Seniority Levels to Scorecard; Org Chart and
// Staffing keep coming from the employee records. What is extracted is saved in the API (frameworkApi)
// so every user sees the same import.

export const MAX_HTML_MB = 5;

export const IMPORTABLE_TABS = {
  seniority: 'Seniority Levels',
  leveling: 'Leveling Detail',
  roles: 'Role Descriptions',
  ladder: 'Career Ladder',
  sizing: 'Org Sizing',
  scorecard: 'Scorecard',
};

const parser = () => new DOMParser();
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const textOf = (node) => clean(node?.textContent);
// Strings inside the data arrays may carry entities or markup (&amp;, <b>): keep only the text
function plain(s) {
  if (!/[<&]/.test(s)) return clean(s);
  return clean(parser().parseFromString(`<body>${s}</body>`, 'text/html').body.textContent);
}

// Cuts a JSON array/object written in a script as `name=[...]` by matching brackets, then JSON.parse
function literal(src, name) {
  const at = src.indexOf(`${name}=`);
  if (at < 0) return null;
  const start = at + name.length + 1;
  const open = src[start];
  if (open !== '[' && open !== '{') return null;
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"') quote = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) {
      try { return JSON.parse(src.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

// JS object literals with bare keys and single-quoted strings ({code:'L1', ...}) → JSON
function looseLiteral(src, name) {
  const at = src.indexOf(`${name}=`);
  if (at < 0) return null;
  const start = at + name.length + 1;
  const end = src.indexOf('];', start);
  if (end < 0) return null;
  const json = src.slice(start, end + 1)
    .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_, s) => JSON.stringify(s.replace(/\\'/g, "'")))
    .replace(/,\s*([\]}])/g, '$1'); // trailing commas are valid JS, not JSON
  try { return JSON.parse(json); } catch { return null; }
}

const scriptsOf = (doc) => [...doc.querySelectorAll('script')].map((s) => s.textContent).join('\n');

function decodeBase64Html(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

// Each tab of the framework is embedded as <section id="view-…"> with an iframe of base64 HTML
function embeddedDocs(doc) {
  const docs = {};
  doc.querySelectorAll('section[id^="view-"]').forEach((section) => {
    const src = section.querySelector('iframe')?.getAttribute('src') || '';
    const m = src.match(/^data:text\/html;base64,(.+)$/);
    if (!m) return;
    try {
      docs[section.id.slice(5)] = parser().parseFromString(decodeBase64Html(m[1]), 'text/html');
    } catch {
      // a broken tab is skipped; the default stays
    }
  });
  return docs;
}

function parseSeniority(doc) {
  const view = doc.getElementById('view-levels');
  const levels = looseLiteral(scriptsOf(doc), 'const LEVELS');
  if (!view || !Array.isArray(levels) || levels.length === 0) return null;
  return {
    heading: textOf(view.querySelector('h2')) || 'Seniority & leveling model',
    intro: textOf(view.querySelector('p.secsub, p')),
    levels: levels.map((l) => ({
      code: clean(l.code),
      name: clean(l.nm || l.name),
      kind: clean(l.band).toUpperCase(),
      fields: Object.entries(l.rows || {}).map(([k, v]) => [clean(k).toUpperCase(), plain(v)]),
    })),
    tracks: [...view.querySelectorAll('.card')].map((card) => ({
      title: textOf(card.querySelector('h3')),
      kind: textOf(card.querySelector('.sub')).toUpperCase(),
      bullets: [...card.querySelectorAll('li')].map(textOf),
    })).filter((t) => t.title),
    workModel: [...view.querySelectorAll('.callout')].map(textOf),
  };
}

function parseLeveling(doc) {
  const src = scriptsOf(doc);
  const levels = literal(src, 'const DATA');
  const dims = literal(src, ',DIMS') || literal(src, 'const DIMS');
  if (!Array.isArray(levels) || !Array.isArray(dims)) return null;
  return levels.map((l) => ({
    code: clean(l.code),
    name: clean(l.name),
    summary: plain(l.summary),
    columns: (l.steps || []).map((s) => clean(s.label).toUpperCase()),
    ready: clean((l.steps || []).map((s) => s.time).filter(Boolean).pop()),
    rows: dims.map((d) => ({ label: d, values: (l.cells?.[d] || []).map(plain) })),
  }));
}

const ROLE_GROUPS = [['vdc', 'VDC Lab'], ['mephub', 'MEPHub'], ['pmh', 'Permit My House'], ['shared', 'Shared'], ['exec', 'Executive']];

function parseRoles(doc) {
  const roles = literal(scriptsOf(doc), 'const DATA');
  if (!Array.isArray(roles) || roles.length === 0) return null;
  const known = new Set(ROLE_GROUPS.map(([, line]) => line));
  const extra = [...new Set(roles.map((r) => r.line).filter((line) => !known.has(line)))]
    .map((line) => [line.toLowerCase().replace(/[^a-z0-9]+/g, '-'), line]);
  return [...ROLE_GROUPS, ...extra].map(([id, line]) => ({
    id,
    label: line,
    roles: roles.filter((r) => r.line === line).map((r) => ({
      line: r.line,
      title: plain(r.title),
      meta: [r.dept && `Department: ${plain(r.dept)}`, r.reports && `Reports to: ${plain(r.reports)}`, r.levels && `Levels: ${plain(r.levels)}`].filter(Boolean).join(' · '),
      sections: [
        { title: 'Purpose', paragraphs: [plain(r.purpose)].filter(Boolean), bullets: [], pairs: [] },
        { title: 'Key responsibilities', paragraphs: [], bullets: (r.resp || []).map(plain), pairs: [] },
        ...(r.ltable?.length ? [{ title: 'Level expectations', paragraphs: [], bullets: [], pairs: r.ltable.map(([k, v]) => [plain(k), plain(v)]) }] : []),
        {
          title: 'Required competencies',
          paragraphs: [],
          bullets: [],
          pairs: [['Technical', r.tech], ['Software & tools', r.software], ['English', r.english], ['Autonomy', r.autonomy], ['Productivity & hours', r.hours]]
            .filter(([, v]) => v).map(([k, v]) => [k, plain(v)]),
        },
        { title: 'Nice to have', paragraphs: [], bullets: (r.nice || []).map(plain), pairs: [] },
        { title: 'Location & work model', paragraphs: [plain(r.location)].filter(Boolean), bullets: [], pairs: [] },
      ].filter((s) => s.paragraphs.length || s.bullets.length || s.pairs.length),
    })),
  })).filter((g) => g.roles.length > 0);
}

function parseLadder(doc, fallback) {
  const main = doc.querySelector('main');
  if (!main || !main.querySelector('.band')) return null;
  const band = (section, track) => ({
    type: 'band',
    code: textOf(section.querySelector('.code')),
    name: textOf(section.querySelector('.bname')),
    steps: [...section.querySelectorAll('.rung')].map((rung) => {
      const next = textOf(rung.querySelector('.ready')).replace(/^▲\s*/, '');
      return { name: textOf(rung.querySelector('.stepbadge')), text: textOf(rung.querySelector('.crit')), ...(next ? { next } : {}) };
    }),
    notes: [...section.querySelectorAll('.bnote')].map(textOf),
    track,
  });
  const items = [];
  const tracks = { ...fallback.tracks };
  let footnote = '';
  [...main.children].forEach((el) => {
    if (el.matches('.band')) items.push(band(el, null));
    else if (el.matches('.converge')) items.push({ type: 'converge', text: textOf(el) });
    else if (el.matches('.forkbar')) items.push({ type: 'note', text: textOf(el).replace(/^[^\p{L}\p{N}]+/u, '') });
    else if (el.matches('.note')) footnote = textOf(el);
    else if (el.matches('.tracks')) {
      [...el.querySelectorAll('.track')].forEach((track, i) => {
        const key = i === 0 ? 'technical' : 'delivery';
        const title = textOf(track.querySelector('h3'));
        if (title) tracks[key] = title;
        track.querySelectorAll('.band').forEach((b) => items.push(band(b, key)));
      });
    }
  });
  const header = doc.querySelector('header');
  return {
    title: textOf(header?.querySelector('h1')) || fallback.title,
    intro: textOf(header?.querySelector('.subh')),
    legend: [...(header?.querySelectorAll('.legend span') || [])].map((s) => textOf(s).replace(/^[^\p{L}\p{N}]+/u, '')).filter(Boolean),
    tracks,
    items,
    footnote,
  };
}

const RATIO_INPUTS = {
  perLead: 'r_desLead',
  leadsPerManager: 'r_leadDM',
  managersPerDirector: 'r_dmDir',
  perReviewer: 'r_qa',
  perPm: 'r_pm',
  backOffice: 'r_back',
};

function parseSizing(doc, fallback) {
  const disc = looseLiteral(scriptsOf(doc), 'const DISC');
  if (!Array.isArray(disc) || disc.length === 0) return null;
  const ratios = { ...fallback.ratios };
  Object.entries(RATIO_INPUTS).forEach(([key, id]) => {
    const value = Number(doc.getElementById(id)?.getAttribute('value'));
    if (Number.isFinite(value) && value >= 0) ratios[key] = value;
  });
  const labels = { vdc: 'VDC Lab', mephub: 'MEPHub', pmh: 'Permit My House' };
  const lines = [...new Set(disc.map((d) => d.line))].map((key) => ({
    line: labels[key] || key,
    key,
    disciplines: disc.filter((d) => d.line === key).map((d) => ({ name: clean(d.n), producers: Math.max(0, Number(d.d) || 0) })),
  }));
  return { intro: textOf(doc.querySelector('header .sub')) || fallback.intro, ratios, lines };
}

function parseScorecard(doc) {
  const src = scriptsOf(doc);
  const steps = literal(src, 'const STEPS');
  const groups = literal(src, ',GROUPS');
  const spine = literal(src, ',SPINE');
  const dims = literal(src, ',DIMS');
  if (![steps, groups, spine, dims].every(Array.isArray)) return null;
  return {
    intro: textOf(doc.querySelector('header .subh')),
    dims,
    steps: steps.map((s) => ({ label: s.label, level: s.level, code: s.code, next: s.next, exp: (s.dims || []).map((d) => plain(d.exp)) })),
    groups: groups.map((g) => ({ level: g.level, code: g.code, idx: g.idx })),
    spine: spine.map((s) => ({ label: s.label, level: s.level, code: s.code, exp: (s.dims || []).map(plain) })),
  };
}

/**
 * Reads the framework HTML and returns the tabs it could rebuild, keyed like the built-in data.
 * Tabs that are missing or unreadable are left out, so the built-in version stays for them.
 */
export function parseFrameworkHtml(rawHtml, defaults) {
  const doc = parser().parseFromString(rawHtml, 'text/html');
  const docs = embeddedDocs(doc);
  const read = (fn) => { try { return fn(); } catch { return null; } };
  const found = {
    seniority: read(() => parseSeniority(doc)),
    leveling: docs.ldetail && read(() => parseLeveling(docs.ldetail)),
    roles: docs.roles && read(() => parseRoles(docs.roles)),
    ladder: docs.ladder && read(() => parseLadder(docs.ladder, defaults.ladder)),
    sizing: docs.calc && read(() => parseSizing(docs.calc, defaults.sizing)),
    scorecard: docs.score && read(() => parseScorecard(docs.score)),
  };
  return Object.fromEntries(Object.entries(found).filter(([, v]) => v && (!Array.isArray(v) || v.length > 0)));
}

// Earlier versions kept the import in this browser: those copies are no longer used
export function clearLocalCopies() {
  try {
    localStorage.removeItem('hris_org_framework');
    localStorage.removeItem('hris_org_framework_v2');
  } catch {
    // storage not available: nothing to clear
  }
}
