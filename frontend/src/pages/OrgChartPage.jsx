import { useEffect, useRef, useState } from 'react';
import { getOrgChart } from '../api/employeesApi';
import { getImportedFramework, importFramework, removeImportedFramework } from '../api/frameworkApi';
import { PageHeader } from '../components/AppLayout';
import { ErrorIcon } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import FRAMEWORK from '../data/orgFramework.json';
import { getErrorMessage } from '../utils/errors';
import { clearLocalCopies, IMPORTABLE_TABS, MAX_HTML_MB, parseFrameworkHtml } from '../utils/orgFramework';
import { formatTimestamp } from '../utils/people';
import { LadderTab, LevelingTab, RolesTab, SeniorityTab, SizingTab } from './orgchart/FrameworkTabs';
import OrgStructureTab from './orgchart/OrgStructureTab';
import ScorecardTab from './orgchart/ScorecardTab';
import StaffingTab from './orgchart/StaffingTab';
import './EmployeeProfilePage.css';
import './OrgChartPage.css';
import './orgchart/orgchart.css';

// Tabs of the Organization & Leveling Framework (Figma). Org Chart and Staffing come from the employee records
const TABS = [
  { id: 'org', label: 'Org Chart' },
  { id: 'staffing', label: 'Staffing' },
  { id: 'seniority', label: 'Seniority Levels' },
  { id: 'leveling', label: 'Leveling Detail' },
  { id: 'roles', label: 'Role Descriptions' },
  { id: 'ladder', label: 'Career Ladder' },
  { id: 'sizing', label: 'Org Sizing' },
  { id: 'scorecard', label: 'Scorecard' },
];
const LIVE_FOOTER = 'Live from the employee records: leaders are assigned from each employee’s profile, and changes show here right away.';

function FrameworkHeader({ children }) {
  return (
    <div className="org__head">
      <div>
        <h1 className="org__title">{FRAMEWORK.title}</h1>
        <p className="org__subtitle">{FRAMEWORK.subtitle}</p>
        <ul className="ofw-brands" aria-label="Service lines">
          {FRAMEWORK.brands.map((b) => <li key={b.line}><span>{b.word}</span> {b.line}</li>)}
        </ul>
      </div>
      <div className="org__meta">
        <span className="org__badge org__badge--imported">{FRAMEWORK.status}</span>
        <span className="ofw-status-note">{FRAMEWORK.statusNote}</span>
        {children}
      </div>
    </div>
  );
}

const tabNames = (keys) => keys.map((k) => IMPORTABLE_TABS[k]).join(', ');

export default function OrgChartPage() {
  const { user } = useAuth();
  const isAdmin = user.rol === 'admin';
  const inputRef = useRef(null);

  // The imported HTML only replaces the tabs from Seniority Levels to Scorecard. It is saved in the API,
  // so everyone sees it. undefined: still loading · null: nothing imported, the built-in framework is shown
  const [imported, setImported] = useState(undefined);
  const [importLoadError, setImportLoadError] = useState('');
  const [tab, setTab] = useState('org');
  const [roleGroup, setRoleGroup] = useState('vdc');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [chart, setChart] = useState(null);
  const [chartError, setChartError] = useState('');
  const needsChart = tab === 'org' || tab === 'staffing';
  const framework = imported ? { ...FRAMEWORK, ...imported.pestanas } : FRAMEWORK;
  const current = TABS.find((item) => item.id === tab) || TABS[0];
  const frameworkReady = imported !== undefined;

  useEffect(() => {
    clearLocalCopies();
    let active = true;
    getImportedFramework()
      .then((data) => { if (active) setImported(data || null); })
      .catch((err) => {
        if (!active) return;
        setImported(null);
        setImportLoadError(`The imported framework could not be loaded (${getErrorMessage(err)}). Showing the built-in one.`);
      });
    return () => { active = false; };
  }, []);

  // The org chart is loaded once and shared by the Org Chart and Staffing tabs
  useEffect(() => {
    if (!needsChart || chart) return undefined;
    let active = true;
    getOrgChart()
      .then((data) => { if (active) setChart(data); })
      .catch((err) => { if (active) setChartError(getErrorMessage(err)); });
    return () => { active = false; };
  }, [needsChart, chart]);

  async function handleFile(file) {
    setError('');
    setNotice('');
    const isHtml = /\.html?$/i.test(file.name) || file.type === 'text/html';
    if (!isHtml) {
      setError('The file must be an HTML document (.html or .htm).');
      return;
    }
    if (file.size > MAX_HTML_MB * 1024 * 1024) {
      setError(`The file must be at most ${MAX_HTML_MB} MB.`);
      return;
    }
    setWorking(true);
    try {
      const tabs = parseFrameworkHtml(await file.text(), FRAMEWORK);
      const keys = Object.keys(tabs);
      if (keys.length === 0) {
        setError('This HTML is not an Organization & Leveling Framework export: none of the tabs from Seniority Levels to Scorecard could be read.');
        return;
      }
      let saved;
      try {
        saved = await importFramework(file.name, tabs);
      } catch (err) {
        setError(`The framework could not be saved: ${getErrorMessage(err)}`);
        return;
      }
      setImported(saved);
      setImportLoadError('');
      const missing = Object.keys(IMPORTABLE_TABS).filter((k) => !keys.includes(k));
      setNotice(`${file.name} was imported for everyone. Updated: ${tabNames(keys)}.${missing.length ? ` Not found in the file, kept as they were: ${tabNames(missing)}.` : ''}`);
    } catch {
      setError('The file could not be read. Check that it is the framework HTML and try again.');
    } finally {
      setWorking(false);
    }
  }

  async function removeImport() {
    setError('');
    setNotice('');
    setWorking(true);
    try {
      await removeImportedFramework();
    } catch (err) {
      // 404: it was already removed by someone else, which is what was wanted
      if (err.response?.status !== 404) {
        setError(`The import could not be removed: ${getErrorMessage(err)}`);
        return;
      }
    } finally {
      setWorking(false);
    }
    setImported(null);
    setNotice(`The import was removed for everyone. ${tabNames(Object.keys(IMPORTABLE_TABS))} are back to the built-in framework.`);
  }

  return (
    <>
      <PageHeader crumbs={[{ label: 'Org Chart' }, { label: current.label }]}>
        {isAdmin && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".html,.htm,text/html"
              className="sr-only"
              aria-label="HTML file to import"
              onChange={(e) => {
                if (e.target.files[0]) handleFile(e.target.files[0]);
                e.target.value = '';
              }}
            />
            <button type="button" className="btn" disabled={working} onClick={() => inputRef.current.click()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V4M7 9l5-5 5 5M4.5 20.5h15" />
              </svg>
              {working ? 'Importing…' : 'Upload HTML'}
            </button>
          </>
        )}
      </PageHeader>

      <main className="app__content org">
        <FrameworkHeader>
          {imported && (
            <span className="org__imported">
              Imported {imported.nombreArchivo} · {formatTimestamp(imported.importadoEn)}{imported.importadoPor ? ` · by ${imported.importadoPor}` : ''}
            </span>
          )}
          {imported && isAdmin && <button type="button" className="org__restore" disabled={working} onClick={removeImport}>Remove import</button>}
        </FrameworkHeader>

        {notice && <p className="org__notice" role="status">{notice}</p>}
        {importLoadError && <p className="profile__alert" role="alert">{importLoadError}</p>}
        {error && <p className="profile__alert org__error" role="alert"><ErrorIcon />{error}</p>}

        <div className="tabs" role="tablist" aria-label="Org chart sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={current.id === item.id}
              className={`tabs__tab${current.id === item.id ? ' is-active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Remounted on every import so the editable tabs (Org Sizing, Scorecard) start from the new data */}
        <div role="tabpanel" aria-label={current.label} key={imported?.importadoEn || 'built-in'}>
          {needsChart && chartError && <p className="profile__alert" role="alert">{chartError}</p>}
          {needsChart && !chartError && !chart && <p className="profile__loading" role="status">Loading the org chart…</p>}
          {current.id === 'org' && chart && <OrgStructureTab chart={chart} isAdmin={isAdmin} footer={LIVE_FOOTER} />}
          {current.id === 'staffing' && chart && <StaffingTab chart={chart} isAdmin={isAdmin} footer={LIVE_FOOTER} />}
          {!needsChart && !frameworkReady && <p className="profile__loading" role="status">Loading the framework…</p>}
          {frameworkReady && (
            <>
              {current.id === 'seniority' && <SeniorityTab framework={framework} />}
              {current.id === 'leveling' && <LevelingTab framework={framework} />}
              {current.id === 'roles' && <RolesTab framework={framework} group={roleGroup} onGroup={setRoleGroup} />}
              {current.id === 'ladder' && <LadderTab framework={framework} />}
              {current.id === 'sizing' && <SizingTab framework={framework} />}
              {current.id === 'scorecard' && <ScorecardTab framework={framework} />}
            </>
          )}
        </div>
      </main>
    </>
  );
}
