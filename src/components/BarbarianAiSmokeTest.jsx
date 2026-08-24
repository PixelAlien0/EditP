import { useEffect, useMemo, useState } from 'react';
import {
  buildAiSmokeTestProtocol,
  buildAiSmokeTestSummary,
  createAiSmokeTestRecord,
  normalizeAiSmokeTestRecord,
  serializeAiSmokeTestReport,
  summarizeAiSmokeTestRecord,
} from '../utils/barbarianAiSmokeTest.js';
import { Badge, Button, ButtonGroup, Callout, SelectField, StatusBadge, TextAreaField, TextField, Type } from './ui.jsx';

const STATUS_OPTIONS = Object.freeze([
  ['passed', 'Pass'],
  ['failed', 'Fail'],
  ['skipped', 'Skip'],
]);

function safeFileName(value) {
  return String(value || 'ai-package').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ai-package';
}

function storageKey(fingerprint) {
  return `editp_ai_smoke_test_v1_${fingerprint}`;
}

function loadRecord(audit, fingerprint) {
  try {
    const stored = localStorage.getItem(storageKey(fingerprint));
    return stored ? normalizeAiSmokeTestRecord(audit, JSON.parse(stored)) : createAiSmokeTestRecord(audit);
  } catch {
    return createAiSmokeTestRecord(audit);
  }
}

function verdictStatus(verdict) {
  if (verdict === 'failed') return 'danger';
  if (verdict === 'passed') return 'success';
  return 'warning';
}

function verdictLabel(verdict) {
  if (verdict === 'failed') return 'Runtime failure recorded';
  if (verdict === 'passed') return 'Manual checks passed';
  return 'Testing incomplete';
}

export default function BarbarianAiSmokeTest({ audit, onNotice }) {
  const protocol = useMemo(() => buildAiSmokeTestProtocol(audit), [audit]);
  const [record, setRecord] = useState(() => loadRecord(audit, protocol.package.fingerprint));
  const summary = useMemo(() => summarizeAiSmokeTestRecord(audit, record), [audit, record]);

  useEffect(() => {
    setRecord(loadRecord(audit, protocol.package.fingerprint));
  }, [audit, protocol.package.fingerprint]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(protocol.package.fingerprint), JSON.stringify(record));
    } catch {
      // The workbench remains usable when browser storage is unavailable.
    }
  }, [protocol.package.fingerprint, record]);

  const updateEnvironment = (field, value) => {
    setRecord(current => ({ ...current, environment: { ...current.environment, [field]: value } }));
  };

  const updateTest = (id, patch) => {
    setRecord(current => ({
      ...current,
      results: {
        ...current.results,
        [id]: { ...current.results[id], ...patch },
      },
    }));
  };

  const resetRecord = () => {
    setRecord(createAiSmokeTestRecord(audit));
    onNotice?.('Reset the local AI smoke-test record.');
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildAiSmokeTestSummary(audit, record));
    onNotice?.('Copied the manual AI smoke-test summary.');
  };

  const downloadReport = () => {
    const blob = new Blob([serializeAiSmokeTestReport(audit, record)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeFileName(protocol.package.shortName || protocol.package.name)}-smoke-test.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    onNotice?.('Downloaded the sanitized AI smoke-test evidence.');
  };

  return (
    <div className="barbarian-ai-smoke-test">
      <header className="barbarian-ai-smoke-test__header">
        <div>
          <Type variant="eyebrow">Phase 6 / Runtime verification</Type>
          <Type as="h3" variant="section-title">Manual smoke-test record</Type>
          <Type as="p" variant="description">
            Record what happened in BAR against this exact package fingerprint. Progress stays in this browser until you reset it.
          </Type>
        </div>
        <div className="barbarian-ai-smoke-test__actions">
          <Button variant="quiet" onClick={resetRecord}>Reset test</Button>
          <Button variant="secondary" onClick={copySummary}>Copy summary</Button>
          <Button variant="primary" onClick={downloadReport}>Download evidence</Button>
        </div>
      </header>

      <section className="barbarian-ai-smoke-test__status" aria-labelledby="ai-smoke-status-title">
        <div>
          <StatusBadge status={verdictStatus(summary.verdict)}>{verdictLabel(summary.verdict)}</StatusBadge>
          <Type as="h4" variant="subsection-title" id="ai-smoke-status-title">{protocol.package.name}</Type>
          <code>{protocol.package.fingerprint}</code>
        </div>
        <dl>
          <div><dt>Passed</dt><dd>{summary.passed}</dd></div>
          <div><dt>Failed</dt><dd>{summary.failed}</dd></div>
          <div><dt>Pending</dt><dd>{summary.pending}</dd></div>
          <div><dt>Total</dt><dd>{summary.total}</dd></div>
        </dl>
      </section>

      <section className="barbarian-ai-smoke-test__environment" aria-labelledby="ai-smoke-environment-title">
        <div className="barbarian-ai-smoke-test__section-heading">
          <div>
            <Type variant="eyebrow">Test environment</Type>
            <Type as="h4" variant="subsection-title" id="ai-smoke-environment-title">Record the runtime you actually tested</Type>
          </div>
          <Badge tone="neutral">Local evidence</Badge>
        </div>
        <div className="barbarian-ai-smoke-test__environment-grid">
          <SelectField label="Platform" value={record.environment.platform} onChange={event => updateEnvironment('platform', event.target.value)}>
            <option value="">Not recorded</option>
            <option value="windows">Windows</option>
            <option value="linux">Linux</option>
            <option value="macos">macOS</option>
            <option value="other">Other</option>
          </SelectField>
          <TextField label="BAR version" placeholder="e.g. test-31531" value={record.environment.barVersion} onChange={event => updateEnvironment('barVersion', event.target.value)} />
          <TextField label="Engine version" placeholder="e.g. 2026.07.04" value={record.environment.engineVersion} onChange={event => updateEnvironment('engineVersion', event.target.value)} />
          <TextField label="Map" placeholder="Map used for the test" value={record.environment.mapName} onChange={event => updateEnvironment('mapName', event.target.value)} />
        </div>
      </section>

      <section className="barbarian-ai-smoke-test__protocol" aria-labelledby="ai-smoke-protocol-title">
        <div className="barbarian-ai-smoke-test__section-heading">
          <div>
            <Type variant="eyebrow">Verification protocol</Type>
            <Type as="h4" variant="subsection-title" id="ai-smoke-protocol-title">Run each check inside BAR</Type>
          </div>
          <span>{summary.passed + summary.failed + summary.skipped} of {summary.total} reviewed</span>
        </div>
        <div className="barbarian-ai-smoke-test__test-list">
          {protocol.tests.map((test, index) => {
            const result = record.results[test.id];
            return (
              <article className={`barbarian-ai-smoke-test__test is-${result.status}`} key={test.id}>
                <span className="barbarian-ai-smoke-test__index">{String(index + 1).padStart(2, '0')}</span>
                <div className="barbarian-ai-smoke-test__test-copy">
                  <header>
                    <strong>{test.label}</strong>
                    {test.critical && <Badge tone="warning" size="sm">Required</Badge>}
                  </header>
                  <p>{test.description}</p>
                </div>
                <ButtonGroup className="barbarian-ai-smoke-test__result-options" label={`${test.label} result`}>
                  {STATUS_OPTIONS.map(([status, label]) => (
                    <Button
                      size="sm"
                      variant={result.status === status ? 'primary' : 'secondary'}
                      aria-pressed={result.status === status}
                      onClick={() => updateTest(test.id, { status: result.status === status ? 'pending' : status })}
                      key={status}
                    >
                      {label}
                    </Button>
                  ))}
                </ButtonGroup>
                <TextField
                  label="Evidence note"
                  placeholder="What happened? Include a concise error or observation."
                  value={result.note}
                  onChange={event => updateTest(test.id, { note: event.target.value })}
                />
              </article>
            );
          })}
        </div>
      </section>

      <section className="barbarian-ai-smoke-test__notes">
        <TextAreaField
          label="Session notes"
          description="Do not paste private paths, credentials, or an entire infolog. Record only the evidence needed to reproduce the result."
          rows={4}
          value={record.notes}
          onChange={event => setRecord(current => ({ ...current, notes: event.target.value }))}
        />
        <Callout tone="info" title="Manual verification boundary">
          This phase records your BAR test results. It does not launch BAR, execute imported code, or prove native behavior automatically.
        </Callout>
      </section>
    </div>
  );
}
