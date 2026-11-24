import { Link } from 'react-router-dom';
import { STATUS_LABELS } from '../../utils/people';
import { countTeam, plural } from './constants';
import { FooterNote } from './common';

// Everyone in a branch, flattened, grouped by position (the framework groups by seniority)
function groupByPosition(nodes) {
  const groups = new Map();
  const add = (node) => {
    const key = node.cargo || 'No position';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
    node.subordinados.forEach(add);
  };
  nodes.forEach(add);
  return [...groups.entries()]
    .map(([position, people]) => ({ position, people: people.sort((a, b) => a.nombre.localeCompare(b.nombre)) }))
    .sort((a, b) => b.people.length - a.people.length || a.position.localeCompare(b.position));
}

function Status({ estado }) {
  if (!estado || estado === 'Activo') return null;
  return <span className="ostatus">{STATUS_LABELS[estado] || estado}</span>;
}

function PersonCard({ node, tag, isAdmin }) {
  return (
    <article className="sperson">
      {isAdmin
        ? <Link to={`/people/${node.empleadoId}`} className="sperson__name">{node.nombre}</Link>
        : <strong className="sperson__name">{node.nombre}</strong>}
      <span className="sperson__role">{node.cargo || 'No position'}</span>
      <span className="onode__chips">
        {tag && <span className="sperson__tag">{tag}</span>}
        <Status estado={node.estado} />
      </span>
    </article>
  );
}

// A leader inside a branch, with everyone below them grouped by position
function Pod({ leader, people, label, isAdmin }) {
  const groups = groupByPosition(people);
  const total = groups.reduce((t, g) => t + g.people.length, 0);
  return (
    <div className="spod">
      <p className="spod__head">
        <span>
          {label || (isAdmin ? <Link to={`/people/${leader.empleadoId}`}>{leader.nombre}</Link> : leader.nombre)}
          {leader && <small className="spod__role">{leader.cargo || 'No position'}</small>}
        </span>
        <span className="spod__count">{total}</span>
      </p>
      {groups.map((group) => (
        <div key={group.position} className="spod__group">
          <span className="sbadge">{group.position} · {group.people.length}</span>
          <ul>
            {group.people.map((p) => (
              <li key={p.empleadoId}>
                {isAdmin ? <Link to={`/people/${p.empleadoId}`}>{p.nombre}</Link> : p.nombre}
                {p.estado && p.estado !== 'Activo' && <> <Status estado={p.estado} /></>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function StaffingTab({ chart, isAdmin, footer }) {
  const roots = chart.organigrama || [];
  const unassigned = chart.sinAsignar || [];
  const branches = roots.flatMap((root) => root.subordinados.filter((n) => n.esLider || n.subordinados.length > 0));
  const directs = roots.flatMap((root) => root.subordinados.filter((n) => !n.esLider && n.subordinados.length === 0));
  const people = roots.reduce((t, r) => t + 1 + countTeam(r), 0) + unassigned.length;
  let leaders = 0;
  const countLeaders = (n) => { if (n.esLider) leaders += 1; n.subordinados.forEach(countLeaders); };
  roots.forEach(countLeaders);
  const away = [];
  const collectAway = (n) => { if (n.estado && n.estado !== 'Activo') away.push(n); n.subordinados.forEach(collectAway); };
  roots.forEach(collectAway);
  unassigned.forEach(collectAway);

  if (people === 0) return <p className="profile__loading">There are no active employees yet.</p>;

  return (
    <div className="staffing">
      <p className="staffing__intro">
        The real team, mapped from the employee records: each leader’s branch with everyone below them, grouped by position.
      </p>

      <dl className="osize__kpis staffing__kpis">
        <div><dt>people</dt><dd>{people}</dd></div>
        <div><dt>leaders</dt><dd>{leaders}</dd></div>
        <div><dt>teams under the top</dt><dd>{branches.length}</dd></div>
        <div><dt>{unassigned.length === 1 ? 'person without a leader' : 'people without a leader'}</dt><dd>{unassigned.length}</dd></div>
      </dl>

      <div className="staffing__chart">
        {roots.length > 0 && (
          <div className="staffing__tier">
            {roots.map((r) => <PersonCard key={r.empleadoId} node={r} tag={r.esCeo ? 'Executive' : 'Leader'} isAdmin={isAdmin} />)}
          </div>
        )}
        {branches.length > 0 && (
          <div className="staffing__tier">
            {branches.map((b) => <PersonCard key={b.empleadoId} node={b} tag="Leader" isAdmin={isAdmin} />)}
          </div>
        )}

        <div className="staffing__branches">
          {branches.map((b) => {
            const subLeaders = b.subordinados.filter((n) => n.subordinados.length > 0);
            const members = b.subordinados.filter((n) => n.subordinados.length === 0);
            return (
              <section key={b.empleadoId} className="sbranch" aria-label={`${b.nombre}'s team`}>
                <h3 className="sbranch__label">{b.cargo ? `${b.cargo} · ` : ''}{b.nombre}</h3>
                {subLeaders.map((l) => <Pod key={l.empleadoId} leader={l} people={l.subordinados} isAdmin={isAdmin} />)}
                {members.length > 0 && <Pod label={subLeaders.length > 0 ? `Direct team · ${plural(members.length, 'person', 'people')}` : 'Team'} people={members} isAdmin={isAdmin} />}
                {b.subordinados.length === 0 && <p className="sbranch__sub">Nobody reports to this leader yet.</p>}
              </section>
            );
          })}

          {directs.length > 0 && (
            <section className="sbranch" aria-label="Report directly to the top">
              <h3 className="sbranch__label">Report directly to the {roots.length === 1 && roots[0].esCeo ? 'CEO' : 'top'}</h3>
              {directs.map((n) => <PersonCard key={n.empleadoId} node={n} isAdmin={isAdmin} />)}
            </section>
          )}

          {unassigned.length > 0 && (
            <section className="sbranch sbranch--pool" aria-label="Without a leader">
              <Pod label={`Without a leader${isAdmin ? ' — assign one from each profile' : ''}`} people={unassigned} isAdmin={isAdmin} />
            </section>
          )}
        </div>
      </div>

      {away.length > 0 && (
        <p className="staffing__note">
          Not working today: {away.map((n) => `${n.nombre} (${(STATUS_LABELS[n.estado] || n.estado).toLowerCase()})`).join(', ')}.
        </p>
      )}
      <FooterNote>{footer}</FooterNote>
    </div>
  );
}
