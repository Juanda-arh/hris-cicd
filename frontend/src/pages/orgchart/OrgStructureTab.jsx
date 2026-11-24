import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { STATUS_LABELS } from '../../utils/people';
import { countTeam, plural } from './constants';
import { FooterNote } from './common';

const ZOOM = { min: 0.6, max: 1.4, step: 0.1 };
// Each branch under the CEO gets its own accent, like the service lines in the framework
const ACCENTS = ['vdc', 'mephub', 'pmh', 'shared'];

function roleOf(node) {
  if (node.esCeo) return 'CEO';
  return node.esLider ? 'Leader' : 'Employee';
}

function StatusChip({ estado }) {
  if (!estado || estado === 'Activo') return null;
  return <span className="ostatus">{STATUS_LABELS[estado] || estado}</span>;
}

function NodeCard({ node, accent, onOpen, toggle, expanded }) {
  const team = countTeam(node);
  const direct = node.subordinados.length;
  return (
    <div className={`onode${accent ? ` onode--${accent}` : ''}${node.esCeo ? ' onode--exec' : ''}`}>
      <button type="button" className="onode__title" onClick={() => onOpen(node)}>{node.nombre}</button>
      <span className="onode__cargo">{node.cargo || 'No position'}</span>
      <span className="onode__chips">
        {node.esCeo ? <span className="lvl lvl--exec">CEO</span> : node.esLider && <span className="otag otag--dm">LEAD</span>}
        <StatusChip estado={node.estado} />
      </span>
      {toggle && direct > 0 && (
        <button type="button" className="onode__toggle" aria-expanded={expanded} onClick={toggle}>
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> {plural(direct, 'report', 'reports')}{team > direct ? ` · ${plural(team, 'person', 'people')}` : ''}
        </button>
      )}
    </div>
  );
}

function Branch({ node, accent, onOpen }) {
  return (
    <li className="obranch">
      <NodeCard node={node} accent={accent} onOpen={onOpen} />
      {node.subordinados.length > 0 && (
        <ul className="obranch__reports">
          {node.subordinados.map((child) => <Branch key={child.empleadoId} node={child} accent={accent} onOpen={onOpen} />)}
        </ul>
      )}
    </li>
  );
}

function PersonDrawer({ node, boss, isAdmin, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const facts = [
    ['Position', node.cargo || 'No position'],
    ['Role', roleOf(node)],
    ['Status', STATUS_LABELS[node.estado] || node.estado || '—'],
    ['Reports to', boss ? boss.nombre : node.esCeo ? 'Ownership / board' : 'Not assigned'],
    ['Team size', countTeam(node) > 0 ? plural(countTeam(node), 'person', 'people') : '—'],
  ];

  return (
    <dialog
      ref={ref}
      className="odrawer"
      aria-labelledby="odrawer-title"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="modal__stripes" aria-hidden="true"><span /><span /><span /></div>
      <div className="odrawer__body">
        <div className="odrawer__head">
          <div>
            <p className="odrawer__eyebrow">{`${roleOf(node)}${node.cargo ? ` · ${node.cargo}` : ''}`.toUpperCase()}</p>
            <h2 id="odrawer-title" className="odrawer__title">{node.nombre}</h2>
          </div>
          <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {node.correo && <a className="odrawer__mail" href={`mailto:${node.correo}`}>{node.correo}</a>}

        {node.funcion && (
          <>
            <h3 className="odrawer__label">Purpose</h3>
            <p className="odrawer__purpose">{node.funcion}</p>
          </>
        )}

        <dl className="odrawer__facts">
          {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>

        {node.subordinados.length > 0 && (
          <>
            <h3 className="odrawer__label">Direct reports · {node.subordinados.length}</h3>
            <ul className="odrawer__reports">
              {node.subordinados.map((r) => (
                <li key={r.empleadoId}>
                  <span>{r.nombre}<small>{r.cargo || 'No position'}</small></span>
                  <span className="onode__chips">{r.esLider && <span className="otag otag--dm">LEAD</span>}<StatusChip estado={r.estado} /></span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {isAdmin && (
        <div className="odrawer__foot">
          <Link to={`/people/${node.empleadoId}`} className="btn btn--dark">Open profile</Link>
          <Link to={`/people/${node.empleadoId}/assign-leader`} className="btn">Change leader</Link>
        </div>
      )}
    </dialog>
  );
}

export default function OrgStructureTab({ chart, isAdmin, footer }) {
  const roots = useMemo(() => chart.organigrama || [], [chart]);
  const unassigned = chart.sinAsignar || [];
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(() => new Set());
  const [zoom, setZoom] = useState(1);
  const [open, setOpen] = useState(null);

  // Bosses by employee id, for "Reports to"
  const bosses = useMemo(() => {
    const map = new Map();
    const walk = (node) => node.subordinados.forEach((child) => { map.set(child.empleadoId, node); walk(child); });
    roots.forEach(walk);
    return map;
  }, [roots]);

  // Under each CEO: the leaders are the branches; people reporting straight to the CEO go apart
  const branches = roots.flatMap((root) => root.subordinados.filter((n) => n.esLider || n.subordinados.length > 0));
  const directs = roots.flatMap((root) => root.subordinados.filter((n) => !n.esLider && n.subordinados.length === 0));
  const accentOf = (node) => ACCENTS[branches.indexOf(node) % ACCENTS.length];
  const allKeys = branches.map((n) => n.empleadoId);
  const isOpen = (id) => filter !== 'all' || expanded.has(id);
  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const visible = filter === 'all' ? branches : branches.filter((n) => n.empleadoId === filter);
  const people = roots.reduce((t, r) => t + 1 + countTeam(r), 0) + unassigned.length;

  if (roots.length === 0 && unassigned.length === 0) {
    return <p className="profile__loading">There are no active employees yet.</p>;
  }

  return (
    <div className="ostructure">
      <p className="ostructure__intro">
        Who reports to whom, <strong>live from the employee records</strong>: {plural(people, 'person', 'people')}, {plural(branches.length, 'team', 'teams')}{unassigned.length > 0 ? ` and ${unassigned.length} without a leader` : ''}.
        Click any box for its detail, use the arrows to collapse/expand, and filter by team below.
        {isAdmin && ' Leaders are assigned from each employee’s profile.'}
      </p>

      {branches.length > 0 && (
        <div className="ostructure__toolbar">
          <div className="ofilter" role="group" aria-label="Filter by team">
            <button type="button" className={`ofilter__item${filter === 'all' ? ' is-active' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All teams</button>
            {branches.map((n) => (
              <button key={n.empleadoId} type="button" className={`ofilter__item${filter === n.empleadoId ? ' is-active' : ''}`} aria-pressed={filter === n.empleadoId} onClick={() => setFilter(n.empleadoId)}>
                <i className={`odot odot--${accentOf(n)}`} aria-hidden="true" />{n.nombre}
              </button>
            ))}
          </div>
          <div className="ostructure__actions">
            <button type="button" className="btn" onClick={() => { setFilter('all'); setExpanded(new Set(allKeys)); }}>Expand all</button>
            <button type="button" className="btn btn--dark" onClick={() => { setFilter('all'); setExpanded(new Set()); }}>Collapse to teams</button>
          </div>
        </div>
      )}

      <div className="ocanvas">
        <div className="ocanvas__zoom">
          <button type="button" className="btn btn--icon" aria-label="Zoom in" disabled={zoom >= ZOOM.max} onClick={() => setZoom((z) => Math.min(ZOOM.max, +(z + ZOOM.step).toFixed(1)))}>+</button>
          <button type="button" className="btn btn--icon" aria-label="Zoom out" disabled={zoom <= ZOOM.min} onClick={() => setZoom((z) => Math.max(ZOOM.min, +(z - ZOOM.step).toFixed(1)))}>−</button>
          <button type="button" className="btn" onClick={() => setZoom(1)}>Fit</button>
        </div>

        <div className="ocanvas__stage" style={{ zoom }}>
          {roots.length > 0 && (
            <div className="ocanvas__top">
              {roots.map((root) => <NodeCard key={root.empleadoId} node={root} onOpen={setOpen} />)}
            </div>
          )}

          {visible.length > 0 && (
            <section className="ogroup" aria-label="Teams">
              <h3 className="ogroup__label">Teams · report to the {roots.length === 1 && roots[0].esCeo ? 'CEO' : 'top'}</h3>
              <ul className="ogroup__shared">
                {visible.map((node) => (
                  <li key={node.empleadoId} className="obranch">
                    <NodeCard node={node} accent={accentOf(node)} onOpen={setOpen} toggle={() => toggle(node.empleadoId)} expanded={isOpen(node.empleadoId)} />
                    {isOpen(node.empleadoId) && node.subordinados.length > 0 && (
                      <ul className="obranch__reports">
                        {node.subordinados.map((child) => <Branch key={child.empleadoId} node={child} accent={accentOf(node)} onOpen={setOpen} />)}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {filter === 'all' && directs.length > 0 && (
            <section className="ogroup" aria-label="Direct reports of the CEO">
              <h3 className="ogroup__label">Report directly to the {roots.length === 1 && roots[0].esCeo ? 'CEO' : 'top'}</h3>
              <ul className="ogroup__shared">
                {directs.map((node) => <li key={node.empleadoId} className="obranch"><NodeCard node={node} onOpen={setOpen} /></li>)}
              </ul>
            </section>
          )}

          {filter === 'all' && unassigned.length > 0 && (
            <section className="ogroup ogroup--unassigned" aria-label="Without a leader">
              <h3 className="ogroup__label">Without a leader · {unassigned.length}</h3>
              <ul className="ogroup__shared">
                {unassigned.map((node) => <li key={node.empleadoId} className="obranch"><NodeCard node={node} onOpen={setOpen} /></li>)}
              </ul>
            </section>
          )}
        </div>
      </div>

      <div className="olegend">
        <span>Legend — border colour = team</span>
        <span><i className="odot odot--exec" aria-hidden="true" />CEO</span>
        <span><span className="otag otag--dm">LEAD</span>Leader (has people in charge)</span>
        <span><span className="ostatus">On vacation</span>Not working today</span>
        <span className="olegend__hint">Click a box for its detail · “Fit” resets the zoom</span>
      </div>

      <FooterNote>{footer}</FooterNote>

      {open && <PersonDrawer node={open} boss={bosses.get(open.empleadoId)} isAdmin={isAdmin} onClose={() => setOpen(null)} />}
    </div>
  );
}
