import {
  buildAiCompatibilityReport,
  buildAiCompatibilitySummary,
  serializeAiCompatibilityReport,
} from '../utils/barbarianAiCompatibilityReport.js';
import { Badge, Button, Callout, StatusBadge, Type } from './ui.jsx';

function reportTone(status) {
  if (status === 'blocked' || status === 'incompatible') return 'danger';
  if (status === 'review') return 'warning';
  return 'success';
}

function reportLabel(status) {
  if (status === 'blocked') return 'Blocked';
  if (status === 'review') return 'Review';
  return 'Passed';
}

function packageVerdict(verdict) {
  if (verdict === 'incompatible') return 'Distribution blocked';
  if (verdict === 'review') return 'Manual review required';
  return 'Static checks passed';
}

export default function BarbarianAiCompatibilityReport({ audit, onNotice }) {
  const report = buildAiCompatibilityReport(audit);

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildAiCompatibilitySummary(audit));
    onNotice?.('Copied the sanitized AI compatibility summary.');
  };

  const downloadReport = () => {
    const blob = new Blob([serializeAiCompatibilityReport(audit)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const packageName = report.package.shortName || report.package.name || 'ai-package';
    anchor.href = url;
    anchor.download = `${packageName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-compatibility-report.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    onNotice?.('Downloaded the sanitized AI compatibility report.');
  };

  return (
    <div className="barbarian-ai-report">
      <header className="barbarian-ai-report__header">
        <div>
          <Type variant="eyebrow">Phase 4 · Compatibility report</Type>
          <Type as="h3" variant="section-title">Distribution readiness</Type>
          <Type as="p" variant="description">
            A deterministic release report built from the static package audit. Imported scripts and native binaries are never included.
          </Type>
        </div>
        <div className="barbarian-ai-report__actions">
          <Button variant="secondary" onClick={copySummary}>Copy summary</Button>
          <Button variant="primary" onClick={downloadReport}>Download report</Button>
        </div>
      </header>

      <section className="barbarian-ai-report__verdict" aria-labelledby="ai-report-verdict-title">
        <div className="barbarian-ai-report__verdict-copy">
          <StatusBadge status={reportTone(report.verdict)}>{packageVerdict(report.verdict)}</StatusBadge>
          <div>
            <Type as="h4" variant="subsection-title" id="ai-report-verdict-title">{report.package.name}</Type>
            <Type as="p" variant="description">
              {report.summary.checksPassed} of {report.summary.checksTotal} release gates passed. In-game testing remains required for native behavior.
            </Type>
          </div>
        </div>
        <dl className="barbarian-ai-report__package-facts">
          <div><dt>Fingerprint</dt><dd>{report.package.fingerprint}</dd></div>
          <div><dt>Files</dt><dd>{report.package.files}</dd></div>
          <div><dt>Profiles</dt><dd>{audit.parsedProfileCount}</dd></div>
          <div><dt>Contract</dt><dd>v{report.contract.version}</dd></div>
        </dl>
      </section>

      <section className="barbarian-ai-report__gates" aria-labelledby="ai-report-gates-title">
        <div className="barbarian-ai-report__section-heading">
          <div>
            <Type variant="eyebrow">Release gates</Type>
            <Type as="h4" variant="subsection-title" id="ai-report-gates-title">Compatibility checks</Type>
          </div>
          <Badge tone={report.summary.blockers ? 'danger' : report.summary.reviews ? 'warning' : 'success'}>
            {report.summary.blockers} blockers · {report.summary.reviews} review
          </Badge>
        </div>
        <div className="barbarian-ai-report__gate-grid">
          {report.checks.map((item, index) => (
            <article className={`barbarian-ai-report__gate is-${item.status}`} key={item.id}>
              <span className="barbarian-ai-report__gate-index">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <header>
                  <strong>{item.label}</strong>
                  <Badge tone={reportTone(item.status)} size="sm">{reportLabel(item.status)}</Badge>
                </header>
                <p>{item.summary}</p>
                {item.evidence.length > 0 && (
                  <div className="barbarian-ai-report__evidence" aria-label={`${item.label} evidence`}>
                    {item.evidence.slice(0, 4).map((value, evidenceIndex) => (
                      <code key={`${value}:${evidenceIndex}`}>{value}</code>
                    ))}
                    {item.evidence.length > 4 && <span>+{item.evidence.length - 4} more</span>}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="barbarian-ai-report__closing-grid">
        <section aria-labelledby="ai-report-actions-title">
          <Type variant="eyebrow">Recommended sequence</Type>
          <Type as="h4" variant="subsection-title" id="ai-report-actions-title">Next actions</Type>
          <ol className="barbarian-ai-report__recommendations">
            {report.recommendations.map((item, index) => (
              <li key={item}><b>{String(index + 1).padStart(2, '0')}</b><span>{item}</span></li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="ai-report-boundary-title">
          <Type variant="eyebrow">Safe report boundary</Type>
          <Type as="h4" variant="subsection-title" id="ai-report-boundary-title">Share findings, not package code</Type>
          <Callout tone="info" title="Sanitized output">
            The exported JSON contains identities, hashes, counts, findings, and contract evidence. It excludes imported source text and native binaries.
          </Callout>
        </section>
      </div>
    </div>
  );
}
