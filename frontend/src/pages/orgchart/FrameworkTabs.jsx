import { useEffect, useState } from 'react';
import { FooterNote, LevelChip } from './common';

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Seniority Levels ---------- */
export function SeniorityTab({ framework }) {
  const s = framework.seniority;
  return (
    <div className="ofw">
      <h2 className="ofw__heading">{s.heading}</h2>
      {s.intro && <p className="ofw__intro">{s.intro}</p>}

      <div className="slevels">
        {s.levels.map((lv) => (
          <article key={lv.code} className={`slevel slevel--${lv.code.toLowerCase()}`}>
            <header className="slevel__head">
              <LevelChip level={lv.code} />
              <div>
                <h3>{lv.name}</h3>
                <p>{lv.kind}</p>
              </div>
            </header>
            <dl className="slevel__fields">
              {lv.fields.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <div className="stracks">
        {s.tracks.map((track) => (
          <article key={track.title} className="strack">
            <h3>{track.title}</h3>
            {track.kind && <p className="strack__kind">{track.kind}</p>}
            <ul>{track.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
          </article>
        ))}
      </div>

      {s.workModel.map((text) => <p key={text} className="ofw__callout">{text}</p>)}
      <FooterNote>{framework.footer}</FooterNote>
    </div>
  );
}

/* ---------- Leveling Detail ---------- */
export function LevelingTab({ framework }) {
  const levels = framework.leveling;
  return (
    <div className="ofw">
      <nav className="oindex" aria-label="Levels">
        <span className="oindex__label">Levels</span>
        {levels.map((lv, i) => (
          <button key={`${lv.code}-${lv.name}`} type="button" className="oindex__item" onClick={() => scrollToId(`lvl-${i}`)}>
            <LevelChip level={lv.code} /> {lv.name}
          </button>
        ))}
      </nav>

      {levels.map((lv, i) => (
        <section key={`${lv.code}-${lv.name}`} id={`lvl-${i}`} className="olevel" aria-labelledby={`lvl-${i}-title`}>
          <header className="olevel__head">
            <LevelChip level={lv.code} />
            <h2 id={`lvl-${i}-title`}>{lv.name}</h2>
          </header>
          <p className="olevel__summary">{lv.summary}</p>
          <div className="otable-wrap">
            <table className="otable">
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  {lv.columns.map((col, c) => (
                    <th key={col} scope="col">
                      {col}
                      {c === lv.columns.length - 1 && lv.ready && <span className="otable__ready">{lv.ready}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lv.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.values.map((v, c) => <td key={c}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="olevel__top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑ Back to levels</button>
        </section>
      ))}
      <FooterNote>{framework.footer}</FooterNote>
    </div>
  );
}

/* ---------- Role Descriptions ---------- */
export function RolesTab({ framework, group, onGroup }) {
  const groups = framework.roles;
  const current = groups.find((g) => g.id === group) || groups[0];

  useEffect(() => { window.scrollTo({ top: 0 }); }, [current.id]);

  return (
    <div className="ofw">
      <div className="ofilter ofilter--wrap" role="group" aria-label="Role group">
        {groups.map((g) => (
          <button key={g.id} type="button" className={`ofilter__item${g.id === current.id ? ' is-active' : ''}`} aria-pressed={g.id === current.id} onClick={() => onGroup(g.id)}>
            {g.label} · {g.roles.length}
          </button>
        ))}
      </div>

      <nav className="oindex oindex--roles" aria-label="Roles">
        <span className="oindex__label">{current.label} · {current.roles.length} {current.roles.length === 1 ? 'role' : 'roles'}</span>
        {current.roles.map((role, i) => (
          <button key={role.title} type="button" className="oindex__item" onClick={() => scrollToId(`role-${i}`)}>{role.title}</button>
        ))}
      </nav>

      {current.roles.map((role, i) => (
        <article key={role.title} id={`role-${i}`} className="orole" aria-labelledby={`role-${i}-title`}>
          <span className="orole__line">{role.line}</span>
          <h2 id={`role-${i}-title`} className="orole__title">{role.title}</h2>
          <p className="orole__meta">{role.meta}</p>
          {role.sections.map((sec) => (
            <section key={sec.title} className="orole__section">
              <h3 className="orole__label">{sec.title}</h3>
              {sec.paragraphs.map((p) => <p key={p}>{p}</p>)}
              {sec.bullets.length > 0 && <ul>{sec.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
              {sec.pairs.length > 0 && (
                <dl className="orole__pairs">
                  {sec.pairs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
              )}
            </section>
          ))}
        </article>
      ))}
      <FooterNote>{framework.footer}</FooterNote>
    </div>
  );
}

/* ---------- Career Ladder ---------- */
function Band({ band }) {
  return (
    <article className={`oband oband--${band.code.toLowerCase()}`}>
      <header className="oband__head"><LevelChip level={band.code} /><h3>{band.name}</h3></header>
      <div className="oband__steps">
        {band.steps.map((step) => (
          <div key={step.name} className="ostep">
            <span className="ostep__name">{step.name}</span>
            <p>{step.text}</p>
            {step.next && <span className="ostep__next">▲ {step.next}</span>}
          </div>
        ))}
      </div>
      {band.notes.map((n) => <p key={n} className="oband__note">{n}</p>)}
    </article>
  );
}

export function LadderTab({ framework }) {
  const l = framework.ladder;
  // Consecutive track bands are shown side by side: technical | delivery
  const blocks = [];
  for (const item of l.items) {
    if (item.type === 'band' && item.track) {
      const last = blocks[blocks.length - 1];
      if (last?.type === 'tracks') last[item.track].push(item);
      else blocks.push({ type: 'tracks', technical: item.track === 'technical' ? [item] : [], delivery: item.track === 'delivery' ? [item] : [] });
    } else blocks.push(item);
  }

  return (
    <div className="ofw">
      <header className="oladder__head">
        <h2 className="ofw__heading">{l.title}</h2>
        <p className="ofw__intro">{l.intro}</p>
        <ul className="oladder__legend">{l.legend.map((x) => <li key={x}>{x}</li>)}</ul>
      </header>

      <div className="oladder">
        {blocks.map((block, i) => {
          if (block.type === 'band') return <Band key={`${block.code}-${block.name}`} band={block} />;
          if (block.type === 'converge') return <p key={i} className="oladder__converge">{block.text}</p>;
          if (block.type === 'note') return <p key={i} className="oladder__fork">{block.text}</p>;
          return (
            <div key={i} className="oladder__tracks">
              {['technical', 'delivery'].map((track) => (
                <div key={track} className="oladder__track">
                  <h3 className="ogroup__label">{l.tracks[track]}</h3>
                  {block[track].map((band) => <Band key={`${band.code}-${band.name}`} band={band} />)}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {l.footnote && <p className="ofw__callout">{l.footnote}</p>}
      <FooterNote>{framework.footer}</FooterNote>
    </div>
  );
}

/* ---------- Org Sizing ---------- */
const RATIO_FIELDS = [
  ['Management spans', [
    ['perLead', 'Producers per Design Lead'],
    ['leadsPerManager', 'Leads per Discipline Manager'],
    ['managersPerDirector', 'Discipline Mgrs per Director'],
  ]],
  ['Shared / cross-cutting', [
    ['perReviewer', 'Producers per QA/QC reviewer'],
    ['perPm', 'Producers per Project Manager'],
    ['backOffice', 'Fixed back-office (HR, Finance, Admin, BD, Estimating)'],
  ]],
];

const ceil = (a, b) => (a > 0 ? Math.ceil(a / Math.max(1, b)) : 0);

function NumberField({ id, label, value, onChange }) {
  return (
    <label className="osize__field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="number" min="0" max="999" inputMode="numeric" value={value} onChange={(e) => onChange(Math.max(0, Math.min(999, Number(e.target.value) || 0)))} />
    </label>
  );
}

export function SizingTab({ framework }) {
  const base = framework.sizing;
  const [ratios, setRatios] = useState(base.ratios);
  const [demand, setDemand] = useState(() => Object.fromEntries(base.lines.flatMap((l) => l.disciplines.map((d) => [d.name, d.producers]))));

  const lines = base.lines.map((line) => {
    const rows = line.disciplines.map((d) => {
      const producers = demand[d.name];
      const leads = ceil(producers, ratios.perLead);
      const managers = ceil(leads, ratios.leadsPerManager);
      return { name: d.name, producers, leads, managers, subtotal: producers + leads + managers };
    });
    const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
    const producers = sum('producers');
    const leads = sum('leads');
    const managers = sum('managers');
    const directors = producers > 0 ? Math.max(1, ceil(managers, ratios.managersPerDirector)) : 0;
    return { ...line, rows, producers, leads, managers, directors, subtotal: producers + leads + managers + directors };
  });
  const producers = lines.reduce((t, l) => t + l.producers, 0);
  const qa = producers > 0 ? 1 + ceil(producers, ratios.perReviewer) : 0;
  const pmo = producers > 0 ? 1 + ceil(producers, ratios.perPm) : 0;
  const shared = qa + pmo + ratios.backOffice;
  const exec = 2;
  const total = lines.reduce((t, l) => t + l.subtotal, 0) + shared + exec;
  const leads = lines.reduce((t, l) => t + l.leads, 0);
  const managers = lines.reduce((t, l) => t + l.managers, 0);
  const directors = lines.reduce((t, l) => t + l.directors, 0);
  const indirect = total - producers;
  const pct = total > 0 ? Math.round((producers / total) * 100) : 0;

  return (
    <div className="ofw osize">
      {base.intro && <p className="ofw__intro">{base.intro}</p>}

      <div className="osize__inputs">
        <section className="osize__panel" aria-labelledby="ratios-title">
          <h2 id="ratios-title" className="section-title">Span-of-control ratios</h2>
          {RATIO_FIELDS.map(([group, fields]) => (
            <fieldset key={group}>
              <legend>{group}</legend>
              {fields.map(([key, label]) => (
                <NumberField key={key} id={`ratio-${key}`} label={label} value={ratios[key]} onChange={(v) => setRatios((r) => ({ ...r, [key]: v }))} />
              ))}
            </fieldset>
          ))}
        </section>
        <section className="osize__panel" aria-labelledby="demand-title">
          <h2 id="demand-title" className="section-title">Producer demand per discipline</h2>
          {base.lines.map((line) => (
            <fieldset key={line.key}>
              <legend><i className={`odot odot--${line.key}`} aria-hidden="true" />{line.line}</legend>
              {line.disciplines.map((d) => (
                <NumberField key={d.name} id={`demand-${d.name}`} label={d.name} value={demand[d.name]} onChange={(v) => setDemand((x) => ({ ...x, [d.name]: v }))} />
              ))}
            </fieldset>
          ))}
          <button type="button" className="btn btn--text" onClick={() => { setRatios(base.ratios); setDemand(Object.fromEntries(base.lines.flatMap((l) => l.disciplines.map((d) => [d.name, d.producers])))); }}>
            Reset to framework values
          </button>
        </section>
      </div>

      <dl className="osize__kpis" aria-live="polite">
        <div><dt>total headcount</dt><dd>{total}</dd></div>
        <div><dt>producers (direct)</dt><dd>{producers}</dd></div>
        <div><dt>leaders (indirect)</dt><dd>{indirect}</dd></div>
        <div><dt>direct of total</dt><dd>{pct}%</dd></div>
      </dl>

      <section aria-labelledby="mix-title">
        <h2 id="mix-title" className="section-title">Direct vs indirect</h2>
        <div className="osize__bar" role="img" aria-label={`${producers} producers and ${indirect} everyone else`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="osize__bar-text">
          {producers} producers · {indirect} everyone else (leads {leads} · discipline managers {managers} · directors {directors} · shared {shared} · executive {exec})
        </p>
      </section>

      <div className="otable-wrap">
        <table className="otable otable--numbers">
          <thead>
            <tr><th scope="col">Discipline / function</th><th scope="col">Producers</th><th scope="col">Leads</th><th scope="col">Disc. mgrs</th><th scope="col">Subtotal</th></tr>
          </thead>
          <tbody>
            {lines.map((line) => [
              <tr key={line.key} className="otable__group">
                <th scope="row"><i className={`odot odot--${line.key}`} aria-hidden="true" />{line.line}</th>
                <td>{line.producers}</td><td>{line.leads}</td><td>{line.managers}</td>
                <td>{line.subtotal} (+{line.directors} dir)</td>
              </tr>,
              ...line.rows.map((r) => (
                <tr key={`${line.key}-${r.name}`}>
                  <th scope="row" className="otable__sub">{r.name}</th>
                  <td>{r.producers}</td><td>{r.leads}</td><td>{r.managers}</td><td>{r.subtotal}</td>
                </tr>
              )),
            ])}
            <tr className="otable__group">
              <th scope="row"><i className="odot odot--shared" aria-hidden="true" />Shared</th>
              <td>—</td><td>—</td><td>—</td><td>{shared}</td>
            </tr>
            <tr><th scope="row" className="otable__sub">QA/QC (1 mgr + {Math.max(0, qa - 1)} reviewers)</th><td>—</td><td>—</td><td>—</td><td>{qa}</td></tr>
            <tr><th scope="row" className="otable__sub">PMO (1 dir + {Math.max(0, pmo - 1)} PMs)</th><td>—</td><td>—</td><td>—</td><td>{pmo}</td></tr>
            <tr><th scope="row" className="otable__sub">Back-office (Estimating, HR, Admin, Finance, BD)</th><td>—</td><td>—</td><td>—</td><td>{ratios.backOffice}</td></tr>
            <tr><th scope="row" className="otable__sub">Executive (CEO + GM/COO)</th><td>—</td><td>—</td><td>—</td><td>{exec}</td></tr>
          </tbody>
          <tfoot>
            <tr><th scope="row">Total</th><td>{producers}</td><td>{leads}</td><td>{managers}</td><td>{total}</td></tr>
          </tfoot>
        </table>
      </div>
      <p className="ofw__callout">
        Leads = ⌈producers ÷ producers per lead⌉ per discipline · Discipline managers = ⌈leads ÷ leads per manager⌉ · one director per {ratios.managersPerDirector} discipline managers (at least one per line) · QA/QC = 1 manager + ⌈producers ÷ {ratios.perReviewer}⌉ · PMO = 1 director + ⌈producers ÷ {ratios.perPm}⌉.
      </p>
      <FooterNote>{framework.footer}</FooterNote>
    </div>
  );
}
