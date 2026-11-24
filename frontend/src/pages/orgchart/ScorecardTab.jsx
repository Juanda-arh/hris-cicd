import { useState } from 'react';
import { LevelChip } from './common';

// Development / promotion and interview / hiring scorecard. Nothing is stored: it is filled in and downloaded as a PDF.
const DEV_RATES = [
  [0, 'Below this step'],
  [1, 'At this step'],
  [2, 'Approaching next'],
  [3, 'At next step'],
];
const TONES = { idle: 'idle', risk: 'risk', track: 'track', developing: 'developing', ready: 'ready' };

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function devVerdict(sc, ratings) {
  const step = sc.steps[ratings.step];
  const next = step.next ? sc.steps.find((s) => s.label === step.next) : null;
  const values = Object.values(ratings.values);
  const n = sc.dims.length;
  const atNext = values.filter((v) => v >= 3).length;
  const below = values.filter((v) => v === 0).length;
  const base = { big: `${atNext}/${n}`, focus: null, next };
  if (values.length < n) return { ...base, tone: TONES.idle, title: 'In progress', sub: `${n - values.length} dimension(s) still to rate.`, pill: 'Scoring…' };
  if (below > 0) return { ...base, tone: TONES.risk, title: `Consolidating ${step.label}`, sub: `${below} dimension(s) below this step — focus there first.`, pill: 'At risk' };
  if (!next) return { ...base, tone: TONES.ready, title: 'Top of ladder', sub: 'No next step — focus on scope & impact.', pill: '—' };
  const gaps = sc.dims.map((d, i) => ({ d, i })).filter(({ i }) => ratings.values[i] < 3);
  const focus = gaps.length ? { title: `Focus areas — path to ${next.label}`, items: gaps.map(({ d, i }) => [d, next.exp[i]]) } : null;
  if (atNext === n) return { ...base, tone: TONES.ready, title: `Ready for ${next.label}`, sub: `Meets the ${next.label} bar on every dimension.`, pill: 'Ready' };
  if (atNext >= n - 3) return { ...base, focus, tone: TONES.track, title: `On track to ${next.label}`, sub: `Close the ${n - atNext} gap area(s) below.`, pill: 'On track' };
  return { ...base, focus, tone: TONES.developing, title: `Solid at ${step.label}`, sub: `Building toward ${next.label} — see focus areas.`, pill: 'Developing' };
}

function hireVerdict(sc, values) {
  const n = sc.dims.length;
  const rated = Object.keys(values).length;
  if (rated < n) return { tone: TONES.idle, big: `${rated}/${n}`, title: 'In progress', sub: `${n - rated} competency(ies) still to rate.`, pill: 'Scoring…', focus: null };
  const raw = sc.dims.map((_, i) => values[i]);
  const clamped = raw.map((v) => Math.max(v, 0));
  const sorted = [...clamped].sort((a, b) => a - b);
  const floor = sorted[0];
  const ceil = sorted[n - 1];
  const median = Math.round((sorted[(n >> 1) - 1] + sorted[n >> 1]) / 2);
  const sug = sc.spine[median];
  const limiters = sc.dims.map((d, i) => ({ d, v: clamped[i] })).filter((x) => x.v < median).sort((a, b) => a.v - b.v);
  const strengths = sc.dims.map((d, i) => ({ d, v: clamped[i] })).filter((x) => x.v > median).sort((a, b) => b.v - a.v);
  const below = sc.dims.filter((_, i) => raw[i] < 0);
  let sub = `Floor (clears on all 8): ${sc.spine[floor].label} · Typical: ${sug.label} · Ceiling: ${sc.spine[ceil].label}.`;
  if (ceil - floor >= 3) sub += ' Wide spread — an uneven candidate; weigh the limiters carefully.';
  const items = [[`Suggested placement: ${sug.code} · ${sug.label}`, 'the midpoint of the eight competency reads.']];
  if (below.length) items.push(['Below entry level', `${below.join(', ')} — may not be ready for the ladder; probe before offer.`]);
  if (limiters.length) items.push(['Holding the level down', `${limiters.map((x) => `${x.d} (${sc.spine[x.v].label})`).join('; ')} — decide if these are dealbreakers or trainable.`]);
  if (strengths.length) items.push(['Strengths above level', `${strengths.map((x) => `${x.d} (${sc.spine[x.v].label})`).join('; ')}.`]);
  return { tone: TONES.ready, big: sug.code, title: `Suggested: ${sug.label}`, sub, pill: `${sug.code} · ${sug.level}`, focus: { title: 'Placement read', items } };
}

export default function ScorecardTab({ framework }) {
  const sc = framework.scorecard;
  const [mode, setMode] = useState('dev');
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({});
  const [notes, setNotes] = useState({});
  const [info, setInfo] = useState({ who: '', role: '', reviewer: '', date: today() });
  const [overall, setOverall] = useState('');

  // Changing what is being rated starts the ratings again
  function restart(apply) {
    apply();
    setValues({});
    setNotes({});
  }

  const current = sc.steps[step];
  const next = current.next ? sc.steps.find((s) => s.label === current.next) : null;
  const verdict = mode === 'dev' ? devVerdict(sc, { step, values }) : hireVerdict(sc, values);
  const setField = (key) => (e) => setInfo((x) => ({ ...x, [key]: e.target.value }));

  function download() {
    const previous = document.title;
    const who = info.who.trim() || (mode === 'dev' ? 'Employee' : 'Candidate');
    document.title = `Scorecard - ${who} - ${info.date || today()}`;
    const restore = () => { document.title = previous; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  }

  return (
    <div className="scard">
      <p className="ofw__intro no-print">{sc.intro} Nothing is saved in the portal — download the PDF to keep a record.</p>

      <div className="scard__bar no-print">
        <div className="ofilter" role="group" aria-label="Scorecard mode">
          {[['dev', 'Development / Promotion'], ['hire', 'Interview / Hiring (Level-Finder)']].map(([id, label]) => (
            <button key={id} type="button" className={`ofilter__item${mode === id ? ' is-active' : ''}`} aria-pressed={mode === id} onClick={() => { if (id !== mode) restart(() => setMode(id)); }}>{label}</button>
          ))}
        </div>
        <button type="button" className="btn btn--dark" onClick={download}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M4.5 20.5h15" /></svg>
          Download PDF
        </button>
      </div>

      <div className="scard__sheet">
        <header className="scard__print-head print-only">
          <strong>MS Systems — {mode === 'dev' ? 'Development / Promotion' : 'Interview / Hiring'} Scorecard</strong>
          <span>{framework.title}</span>
        </header>

        <div className="scard__fields">
          {mode === 'dev' && (
            <label className="scard__field">
              <span>Current step</span>
              <select value={step} onChange={(e) => restart(() => setStep(Number(e.target.value)))}>
                {sc.groups.map((g) => (
                  <optgroup key={`${g.code}-${g.level}`} label={`${g.code} · ${g.level}`}>
                    {g.idx.map((i) => <option key={i} value={i}>{sc.steps[i].label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          <label className="scard__field"><span>{mode === 'dev' ? 'Employee' : 'Candidate'}</span><input value={info.who} onChange={setField('who')} placeholder="Full name" maxLength={120} /></label>
          <label className="scard__field"><span>Role / discipline</span><input value={info.role} onChange={setField('role')} placeholder="e.g. Mechanical MEP Designer" maxLength={120} /></label>
          <label className="scard__field"><span>Reviewer</span><input value={info.reviewer} onChange={setField('reviewer')} placeholder="Who rates" maxLength={120} /></label>
          <label className="scard__field"><span>Date</span><input type="date" value={info.date} onChange={setField('date')} /></label>
        </div>

        <div className={`scard__verdict scard__verdict--${verdict.tone}`} aria-live="polite">
          <span className="scard__big">{verdict.big}</span>
          <div>
            <p className="scard__title">{verdict.title}</p>
            <p className="scard__sub">{verdict.sub}</p>
          </div>
          <span className="scard__pill">{verdict.pill}</span>
        </div>

        {mode === 'dev'
          ? (
            <p className="scard__chip">
              <LevelChip level={current.code} /> {current.label} <span>→ {next ? `next: ${next.label}` : 'top of ladder'}</span>
            </p>
          )
          : <p className="scard__chip"><span className="lvl lvl--exec">LEVEL-FINDER</span> <span>the level is read from your ratings</span></p>}

        <p className="scard__legend">
          {mode === 'dev'
            ? <>Rate each dimension: Below this step · At this step · Approaching next{next ? ` (${next.label})` : ''} · At next step. “At next step” on every dimension = ready to move to {next ? next.label : 'the next step'}.</>
            : <>For each competency, pick the description that best fits the candidate. No target is set up front — the suggested level is inferred from the pattern across all eight.</>}
        </p>

        {verdict.focus && (
          <div className="scard__focus">
            <h3>{verdict.focus.title}</h3>
            <ul>{verdict.focus.items.map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}</ul>
          </div>
        )}

        {sc.dims.map((dim, i) => (
          <section key={dim} className="scard__dim" aria-labelledby={`dim-${i}`}>
            <h3 id={`dim-${i}`}>{dim}</h3>
            {mode === 'dev'
              ? (
                <>
                  <p className="scard__exp"><strong>At {current.label}:</strong> {current.exp[i]}</p>
                  {next && <p className="scard__exp scard__exp--next"><strong>Next ({next.label}):</strong> {next.exp[i]}</p>}
                  <div className="scard__rates" role="radiogroup" aria-labelledby={`dim-${i}`}>
                    {DEV_RATES.map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={values[i] === v}
                        className={`scard__rate scard__rate--${v}${values[i] === v ? ' is-selected' : ''}`}
                        onClick={() => setValues((x) => ({ ...x, [i]: v }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )
              : (
                <>
                  <select
                    className="scard__select"
                    aria-label={`${dim}: best matching description`}
                    value={values[i] ?? ''}
                    onChange={(e) => setValues((x) => {
                      const copy = { ...x };
                      if (e.target.value === '') delete copy[i]; else copy[i] = Number(e.target.value);
                      return copy;
                    })}
                  >
                    <option value="">— choose the best match —</option>
                    <option value="-1">Below entry level (not yet Junior I)</option>
                    {sc.spine.map((s, si) => <option key={s.label} value={si}>{s.label} — {s.exp[i]}</option>)}
                  </select>
                  {values[i] !== undefined && (
                    <p className="scard__exp">
                      {values[i] < 0 ? 'Below entry level' : <><strong>{sc.spine[values[i]].label}:</strong> {sc.spine[values[i]].exp[i]}</>}
                    </p>
                  )}
                </>
              )}
            <textarea
              className="scard__note"
              aria-label={`Evidence for ${dim}`}
              placeholder="Evidence / examples…"
              value={notes[i] || ''}
              onChange={(e) => setNotes((x) => ({ ...x, [i]: e.target.value }))}
            />
            {notes[i] && <p className="scard__note-print print-only">{notes[i]}</p>}
          </section>
        ))}

        <section className="scard__dim" aria-labelledby="overall-title">
          <h3 id="overall-title">Overall summary &amp; agreed actions</h3>
          <textarea
            className="scard__note scard__note--big"
            aria-labelledby="overall-title"
            placeholder="Where they stand, key evidence, agreed focus areas / hiring decision and timeline…"
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
          />
          {overall && <p className="scard__note-print print-only">{overall}</p>}
        </section>

        <p className="scard__signoff print-only">
          {[info.who && `${mode === 'dev' ? 'Employee' : 'Candidate'}: ${info.who}`, info.role && `Role: ${info.role}`, info.reviewer && `Reviewer: ${info.reviewer}`, info.date && `Date: ${info.date}`].filter(Boolean).join('  ·  ')}
        </p>
      </div>
    </div>
  );
}
