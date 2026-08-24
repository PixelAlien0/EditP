import { useMemo } from 'react';
import {
  buildAiUpgradeMigrationChecklist,
  buildAiUpgradeMigrationPlan,
} from '../utils/barbarianAiMigrationPlan.js';
import { Badge, Button, Callout, EmptyState, StatusBadge, Type } from './ui.jsx';

function statusTone(status) {
  if (status === 'blocked') return 'danger';
  if (status === 'review' || status === 'decision') return 'warning';
  if (status === 'ready' || status === 'verified') return 'success';
  return 'info';
}

function verdictLabel(verdict) {
  if (verdict === 'blocked') return 'Migration blocked';
  if (verdict === 'review') return 'Migration decisions required';
  return 'Migration ready to test';
}

export default function BarbarianAiMigrationPlan({ audit, baselineAudit, onOpenComparison, onNotice }) {
  const plan = useMemo(
    () => baselineAudit ? buildAiUpgradeMigrationPlan(baselineAudit, audit) : null,
    [audit, baselineAudit],
  );

  const copyChecklist = async () => {
    await navigator.clipboard.writeText(buildAiUpgradeMigrationChecklist(baselineAudit, audit));
    onNotice?.('Copied the ordered AI upgrade migration checklist.');
  };

  if (!plan) {
    return (
      <div className="barbarian-ai-report">
        <header className="barbarian-ai-report__header">
          <div>
            <Type variant="eyebrow">Phase 9 / Migration plan</Type>
            <Type as="h3" variant="section-title">Turn an upgrade delta into ordered work</Type>
            <Type as="p" variant="description">Load a previous package in Version Comparison, then return here for a prioritized migration and BAR test checklist.</Type>
          </div>
          <Button variant="primary" onClick={onOpenComparison}>Open Version Comparison</Button>
        </header>
        <EmptyState title="A baseline package is required" description="The current package is already loaded. Add its previous version once, then both comparison and migration planning share the same static audit." />
      </div>
    );
  }

  return (
    <div className="barbarian-ai-release">
      <header className="barbarian-ai-release__header">
        <div>
          <Type variant="eyebrow">Phase 9 / Migration plan</Type>
          <Type as="h3" variant="section-title">A controlled path from baseline to current</Type>
          <Type as="p" variant="description">Prioritize package identity, configuration, native-runtime review, and game validation without modifying or executing either package.</Type>
        </div>
        <div className="barbarian-ai-release__actions">
          <Button variant="secondary" onClick={onOpenComparison}>Review comparison</Button>
          <Button variant="primary" onClick={copyChecklist}>Copy migration checklist</Button>
        </div>
      </header>

      <section className={`barbarian-ai-release__status is-${plan.verdict === 'ready' ? 'verified' : plan.verdict}`}>
        <div>
          <StatusBadge status={statusTone(plan.verdict)}>{verdictLabel(plan.verdict)}</StatusBadge>
          <Type as="h4" variant="subsection-title">{plan.baseline.name} to {plan.current.name}</Type>
          <code>{plan.baseline.version} to {plan.current.version}</code>
        </div>
        <dl>
          <div><dt>Blocked</dt><dd>{plan.summary.blocked}</dd></div>
          <div><dt>Decide</dt><dd>{plan.summary.decisions}</dd></div>
          <div><dt>Review</dt><dd>{plan.summary.reviews}</dd></div>
          <div><dt>Verify</dt><dd>{plan.summary.verifies}</dd></div>
        </dl>
      </section>

      {plan.stages.map((stage, stageIndex) => (
        <section className="barbarian-ai-release__gates" key={stage.id} aria-labelledby={`ai-migration-${stage.id}`}>
          <div className="barbarian-ai-release__section-heading">
            <div>
              <Type variant="eyebrow">Stage {String(stageIndex + 1).padStart(2, '0')}</Type>
              <Type as="h4" variant="subsection-title" id={`ai-migration-${stage.id}`}>{stage.label}</Type>
              <Type as="p" variant="description">{stage.description}</Type>
            </div>
            <Badge tone="neutral">{stage.actions.length} actions</Badge>
          </div>
          <div className="barbarian-ai-release__gate-grid">
            {stage.actions.map((item, index) => (
              <article className={`barbarian-ai-release__gate is-${['verify', 'verified', 'decision'].includes(item.status) ? 'review' : item.status}`} key={item.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  {item.evidence && <code>{item.evidence}</code>}
                </div>
                <StatusBadge status={statusTone(item.status)}>{item.status}</StatusBadge>
              </article>
            ))}
          </div>
        </section>
      ))}

      <Callout tone={plan.verdict === 'blocked' ? 'danger' : plan.verdict === 'review' ? 'warning' : 'success'} title={verdictLabel(plan.verdict)}>
        {plan.verdict === 'blocked'
          ? 'Resolve the blocking references or compatibility findings before installing the current package.'
          : plan.verdict === 'review'
            ? 'Complete the listed decisions and reviews, then run the required fresh BAR smoke test.'
            : 'The static migration surface is ready. Runtime compatibility still requires the listed BAR smoke test.'}
      </Callout>
    </div>
  );
}
