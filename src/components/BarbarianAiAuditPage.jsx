import { useMemo, useRef, useState } from 'react';
import { AI_PACKAGE_LIMITS, auditBarbarianAiPackage, readAiPackageFiles } from '../utils/barbarianAiPackage.js';
import BarbarianAiCompatibilityReport from './BarbarianAiCompatibilityReport.jsx';
import BarbarianAiDeploymentPlan from './BarbarianAiDeploymentPlan.jsx';
import BarbarianAiProfileComposer from './BarbarianAiProfileComposer.jsx';
import BarbarianAiReleaseDossier from './BarbarianAiReleaseDossier.jsx';
import BarbarianAiSmokeTest from './BarbarianAiSmokeTest.jsx';
import BarbarianAiVersionComparison from './BarbarianAiVersionComparison.jsx';
import BarbarianAiMigrationPlan from './BarbarianAiMigrationPlan.jsx';
import { Badge, Button, Callout, EmptyState, PageShell, StatusBadge, Type } from './ui.jsx';
import '../styles/features/barbarian-ai-audit.css';

const AUDIT_TABS = Object.freeze([
  ['overview', 'Overview'],
  ['contract', 'Contract'],
  ['profiles', 'Profile Composer'],
  ['report', 'Compatibility Report'],
  ['deployment', 'Deployment Plan'],
  ['testing', 'Smoke Test'],
  ['release', 'Release Dossier'],
  ['comparison', 'Version Comparison'],
  ['migration', 'Migration Plan'],
  ['findings', 'Findings'],
  ['files', 'Files'],
]);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function severityTone(severity) {
  if (severity === 'blocker') return 'danger';
  if (severity === 'review') return 'warning';
  return 'neutral';
}

function compatibilityLabel(value) {
  if (value === 'incompatible') return 'Blocked';
  if (value === 'review') return 'Review required';
  return 'Compatible';
}

function OverviewPanel({ audit }) {
  const { identity } = audit.contract;
  return (
    <div className="barbarian-ai-audit__overview-grid">
      <section className="barbarian-ai-audit__identity" aria-labelledby="ai-audit-identity-title">
        <Type variant="eyebrow">Package identity</Type>
        <Type as="h3" variant="section-title" id="ai-audit-identity-title">
          {identity.name || identity.shortName || 'Unidentified Skirmish AI'}
        </Type>
        <Type as="p" variant="description">{identity.description || 'No literal description was discovered in AIInfo.lua.'}</Type>
        <dl>
          <div><dt>Short name</dt><dd>{identity.shortName || 'Unknown'}</dd></div>
          <div><dt>Version</dt><dd>{identity.version || 'Unknown'}</dd></div>
          <div><dt>Contract</dt><dd>v{audit.contract.version}</dd></div>
          <div><dt>Profiles parsed</dt><dd>{audit.parsedProfileCount}</dd></div>
        </dl>
      </section>

      <section className="barbarian-ai-audit__safety" aria-labelledby="ai-audit-safety-title">
        <Type variant="eyebrow">Inspection boundary</Type>
        <Type as="h3" variant="section-title" id="ai-audit-safety-title">Static and read-only</Type>
        <Type as="p" variant="description">
          JSONC and literal metadata are parsed in the browser. Lua, AngelScript, and native runtimes are never executed or loaded.
        </Type>
        <div className="barbarian-ai-audit__safety-ledger">
          <span><b>{audit.totals.scripts}</b> scripts inspected</span>
          <span><b>{audit.totals.nativeFiles}</b> binaries fingerprinted</span>
          <span><b>{audit.references.referenced.length}</b> current unit references</span>
        </div>
      </section>
    </div>
  );
}

function ContractPanel({ audit }) {
  return (
    <div className="barbarian-ai-audit__contract-grid">
      <section>
        <header>
          <div>
            <Type variant="eyebrow">Discovered profile surface</Type>
            <Type as="h3" variant="section-title">BARbarIAn configuration groups</Type>
          </div>
          <Badge tone="info">{audit.contract.profileSurfaces.length} groups</Badge>
        </header>
        <div className="barbarian-ai-audit__surface-list">
          {audit.contract.profileSurfaces.length ? audit.contract.profileSurfaces.map(surface => (
            <article key={surface.id}>
              <div><strong>{surface.label}</strong><span>{surface.description}</span></div>
              <Badge tone="neutral" size="sm">{surface.files.length} files</Badge>
            </article>
          )) : <Type as="p" variant="description">No canonical BARbarIAn profile groups were discovered.</Type>}
        </div>
      </section>

      <section>
        <header>
          <div>
            <Type variant="eyebrow">Lobby contract</Type>
            <Type as="h3" variant="section-title">Options and runtime routes</Type>
          </div>
          <Badge tone="neutral">{audit.contract.optionKeys.length} options</Badge>
        </header>
        <div className="barbarian-ai-audit__token-list">
          {audit.contract.optionKeys.length
            ? audit.contract.optionKeys.map(key => <code key={key}>{key}</code>)
            : <Type as="p" variant="description">No literal AI option keys were discovered.</Type>}
        </div>
        <div className="barbarian-ai-audit__runtime-list">
          {audit.contract.runtimeFingerprints.map(runtime => (
            <div key={runtime.path}>
              <span>{runtime.path}</span><code>{runtime.hash}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FindingsPanel({ audit }) {
  if (!audit.findings.length) {
    return <EmptyState title="No compatibility findings" description="The imported package matches the currently understood contract surface." />;
  }
  return (
    <div className="barbarian-ai-audit__finding-list">
      {audit.findings.map(item => (
        <article key={item.id} className={`barbarian-ai-audit__finding is-${item.severity}`}>
          <Badge tone={severityTone(item.severity)} size="sm">{item.severity}</Badge>
          <div>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            {item.path && <code>{item.path}</code>}
          </div>
        </article>
      ))}
    </div>
  );
}

function FilesPanel({ audit }) {
  return (
    <div className="barbarian-ai-audit__file-table" role="table" aria-label="Imported AI package files">
      <div className="barbarian-ai-audit__file-row is-header" role="row">
        <span role="columnheader">Path</span><span role="columnheader">Kind</span><span role="columnheader">Size</span><span role="columnheader">Fingerprint</span>
      </div>
      {audit.files.map(record => (
        <div className="barbarian-ai-audit__file-row" role="row" key={record.path}>
          <code role="cell">{record.path}</code>
          <span role="cell">{record.kind}</span>
          <span role="cell">{formatBytes(record.size)}</span>
          <code role="cell">{record.hash}</code>
        </div>
      ))}
    </div>
  );
}

export default function BarbarianAiAuditPage({ units = [], onBack, onNotice }) {
  const folderInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [audit, setAudit] = useState(null);
  const [baselineAudit, setBaselineAudit] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const knownUnitIds = useMemo(() => units.map(unit => unit.id), [units]);

  const importFiles = async event => {
    const selectedFiles = event.target.files;
    if (!selectedFiles?.length) return;
    setLoading(true);
    setError('');
    try {
      const records = await readAiPackageFiles(selectedFiles);
      const nextAudit = auditBarbarianAiPackage(records, { knownUnitIds });
      setAudit(nextAudit);
      setBaselineAudit(null);
      setActiveTab('overview');
      onNotice?.(`Inspected ${records.length} AI package files without executing package code.`);
    } catch (importError) {
      setAudit(null);
      setBaselineAudit(null);
      setError(importError.message || 'The package could not be inspected.');
    } finally {
      event.target.value = '';
      setLoading(false);
    }
  };

  const status = audit ? (
    <StatusBadge status={audit.compatibility === 'compatible' ? 'success' : audit.compatibility === 'review' ? 'warning' : 'danger'}>
      {compatibilityLabel(audit.compatibility)}
    </StatusBadge>
  ) : <StatusBadge status="neutral">No package loaded</StatusBadge>;

  return (
    <PageShell
      className="barbarian-ai-audit"
      bodyClassName="barbarian-ai-audit__body"
      eyebrow="Skirmish AI research"
      title="AI Package Audit"
      description="Discover a BARbarIAn package contract, compare its profile surface, and flag compatibility risks without executing imported code."
      capabilityId="tool.ai-package-audit"
      metrics={audit ? [
        { label: 'Files', value: audit.totals.files, detail: formatBytes(audit.totals.bytes) },
        { label: 'Profile groups', value: audit.contract.profileSurfaces.length, detail: `${audit.parsedProfileCount} configs parsed` },
        { label: 'Review items', value: audit.totals.blockers + audit.totals.reviews, detail: `${audit.totals.blockers} blockers` },
      ] : []}
      status={status}
      actions={<Button variant="secondary" onClick={onBack}>Back to editor</Button>}
      toolbar={(
        <div className="barbarian-ai-audit__import-deck">
          <div>
            <Type variant="eyebrow">Package intake</Type>
            <Type as="strong" variant="subsection-title">Folder, ZIP, or selected files</Type>
            <Type as="span" variant="description">Up to {AI_PACKAGE_LIMITS.maxFiles} files and {AI_PACKAGE_LIMITS.maxPackageBytes / 1024 / 1024} MB total.</Type>
          </div>
          <div className="barbarian-ai-audit__import-actions">
            <Button variant="primary" loading={loading} onClick={() => folderInputRef.current?.click()}>Choose AI folder</Button>
            <Button variant="secondary" disabled={loading} onClick={() => fileInputRef.current?.click()}>Choose ZIP or files</Button>
            {audit && <Button variant="quiet" onClick={() => { setAudit(null); setBaselineAudit(null); setError(''); }}>Clear audit</Button>}
            <input ref={folderInputRef} className="barbarian-ai-audit__native-input" type="file" multiple webkitdirectory="" directory="" onChange={importFiles} />
            <input ref={fileInputRef} className="barbarian-ai-audit__native-input" type="file" multiple accept=".zip,.lua,.as,.json,.jsonc,.dll,.so,.dylib,.txt,.md" onChange={importFiles} />
          </div>
        </div>
      )}
    >
      {error && <Callout tone="danger" title="Package could not be inspected">{error}</Callout>}
      {!audit ? (
        <section className="barbarian-ai-audit__empty" aria-labelledby="ai-audit-empty-title">
          <div className="barbarian-ai-audit__empty-copy">
            <Type variant="eyebrow">Inspection workspace</Type>
            <Type as="h2" variant="section-title" id="ai-audit-empty-title">Choose a package to begin</Type>
            <Type as="p" variant="description">Select an AI root folder for the clearest audit, or use a ZIP and selected files. Imported code is read as text only and is never executed.</Type>
          </div>
          <ol className="barbarian-ai-audit__empty-ledger" aria-label="Audit workflow">
            <li><b>01</b><span>Discover contract</span></li>
            <li><b>02</b><span>Parse profiles</span></li>
            <li><b>03</b><span>Compare references</span></li>
            <li><b>04</b><span>Report compatibility</span></li>
          </ol>
        </section>
      ) : (
        <section className="barbarian-ai-audit__workbench">
          <div className="barbarian-ai-audit__tabs" role="tablist" aria-label="AI package audit views">
            {AUDIT_TABS.map(([id, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                aria-controls={`ai-audit-panel-${id}`}
                className={activeTab === id ? 'is-active' : ''}
                onClick={() => setActiveTab(id)}
                key={id}
              >
                {label}
                {id === 'findings' && <Badge tone={audit.totals.blockers ? 'danger' : audit.totals.reviews ? 'warning' : 'neutral'} size="sm">{audit.findings.length}</Badge>}
              </button>
            ))}
          </div>
          <div id={`ai-audit-panel-${activeTab}`} role="tabpanel" className="barbarian-ai-audit__panel">
            {activeTab === 'overview' && <OverviewPanel audit={audit} />}
            {activeTab === 'contract' && <ContractPanel audit={audit} />}
            {activeTab === 'profiles' && <BarbarianAiProfileComposer audit={audit} onNotice={onNotice} />}
            {activeTab === 'report' && <BarbarianAiCompatibilityReport audit={audit} onNotice={onNotice} />}
            {activeTab === 'deployment' && <BarbarianAiDeploymentPlan audit={audit} onNotice={onNotice} />}
            {activeTab === 'testing' && <BarbarianAiSmokeTest audit={audit} onNotice={onNotice} />}
            {activeTab === 'release' && <BarbarianAiReleaseDossier audit={audit} onNotice={onNotice} />}
            {activeTab === 'comparison' && <BarbarianAiVersionComparison audit={audit} baselineAudit={baselineAudit} onBaselineAuditChange={setBaselineAudit} knownUnitIds={knownUnitIds} onNotice={onNotice} />}
            {activeTab === 'migration' && <BarbarianAiMigrationPlan audit={audit} baselineAudit={baselineAudit} onOpenComparison={() => setActiveTab('comparison')} onNotice={onNotice} />}
            {activeTab === 'findings' && <FindingsPanel audit={audit} />}
            {activeTab === 'files' && <FilesPanel audit={audit} />}
          </div>
        </section>
      )}
    </PageShell>
  );
}
