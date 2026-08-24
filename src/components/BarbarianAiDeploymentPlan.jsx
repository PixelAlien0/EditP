import {
  buildAiDeploymentChecklist,
  buildAiDeploymentPlan,
  serializeAiDeploymentPlan,
} from '../utils/barbarianAiDeploymentPlan.js';
import { Badge, Button, Callout, StatusBadge, Type } from './ui.jsx';

function readinessTone(status) {
  if (status === 'blocked') return 'danger';
  if (status === 'review') return 'warning';
  return 'success';
}

function readinessLabel(status) {
  if (status === 'blocked') return 'Installation blocked';
  if (status === 'review') return 'Review before installing';
  return 'Plan ready';
}

function downloadText(contents, filename, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function BarbarianAiDeploymentPlan({ audit, onNotice }) {
  const plan = buildAiDeploymentPlan(audit);
  const fileStem = (plan.package.shortName || plan.package.name || 'ai-package').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const copyTarget = async () => {
    await navigator.clipboard.writeText(plan.destination);
    onNotice?.('Copied the relative Skirmish AI installation path.');
  };

  const copyChecklist = async () => {
    await navigator.clipboard.writeText(buildAiDeploymentChecklist(audit));
    onNotice?.('Copied the AI deployment checklist.');
  };

  const downloadManifest = () => {
    downloadText(serializeAiDeploymentPlan(audit), `${fileStem}-deployment-plan.json`, 'application/json');
    onNotice?.('Downloaded the sanitized AI deployment manifest.');
  };

  return (
    <div className="barbarian-ai-deployment">
      <header className="barbarian-ai-deployment__header">
        <div>
          <Type variant="eyebrow">Phase 5 / Deployment readiness</Type>
          <Type as="h3" variant="section-title">Installation plan</Type>
          <Type as="p" variant="description">
            Prepare a deterministic package route and smoke-test sequence. BAR Editor does not install, execute, or rebuild the imported AI runtime.
          </Type>
        </div>
        <div className="barbarian-ai-deployment__actions">
          <Button variant="secondary" onClick={copyChecklist}>Copy checklist</Button>
          <Button variant="primary" onClick={downloadManifest}>Download manifest</Button>
        </div>
      </header>

      <section className="barbarian-ai-deployment__route" aria-labelledby="ai-deployment-route-title">
        <div>
          <StatusBadge status={readinessTone(plan.readiness)}>{readinessLabel(plan.readiness)}</StatusBadge>
          <Type variant="eyebrow">Relative engine route</Type>
          <Type as="h4" variant="subsection-title" id="ai-deployment-route-title">{plan.package.name}</Type>
        </div>
        <button type="button" className="barbarian-ai-deployment__path" onClick={copyTarget} aria-label="Copy relative AI package path">
          <code>{plan.destination}</code>
          <span>Copy path</span>
        </button>
      </section>

      <section aria-labelledby="ai-deployment-platforms-title">
        <div className="barbarian-ai-deployment__section-heading">
          <div>
            <Type variant="eyebrow">Runtime inventory</Type>
            <Type as="h4" variant="subsection-title" id="ai-deployment-platforms-title">Platform coverage</Type>
          </div>
          <Badge tone="neutral">{plan.coverage.filter(item => item.status === 'present').length} of {plan.coverage.length} detected</Badge>
        </div>
        <div className="barbarian-ai-deployment__platform-grid">
          {plan.coverage.map(platform => (
            <article className={`barbarian-ai-deployment__platform is-${platform.status}`} key={platform.id}>
              <header>
                <strong>{platform.label}</strong>
                <Badge tone={platform.status === 'present' ? 'success' : 'neutral'} size="sm">{platform.status}</Badge>
              </header>
              {platform.files.length ? platform.files.map(file => (
                <div key={file.path}><code>{file.path}</code><span>{file.hash}</span></div>
              )) : <p>No matching native runtime was found in this package.</p>}
            </article>
          ))}
        </div>
      </section>

      <div className="barbarian-ai-deployment__closing-grid">
        <section aria-labelledby="ai-deployment-steps-title">
          <Type variant="eyebrow">Controlled handoff</Type>
          <Type as="h4" variant="subsection-title" id="ai-deployment-steps-title">Install and smoke test</Type>
          <ol className="barbarian-ai-deployment__steps">
            {plan.steps.map((step, index) => (
              <li key={step}><b>{String(index + 1).padStart(2, '0')}</b><span>{step}</span></li>
            ))}
          </ol>
        </section>
        <section className="barbarian-ai-deployment__boundary" aria-labelledby="ai-deployment-boundary-title">
          <Type variant="eyebrow">Deployment boundary</Type>
          <Type as="h4" variant="subsection-title" id="ai-deployment-boundary-title">What this phase does not do</Type>
          <Callout tone="warning" title="Original runtime required">
            Profile Composer creates a safe overlay, not a native Skirmish AI. Install the original compatible package first, then apply any exported overlay.
          </Callout>
          <ul>
            {plan.cautions.map(item => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
