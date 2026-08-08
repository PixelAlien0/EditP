import { Button, EmptyState, Type } from './ui.jsx';
import '../styles/features/project-integrity-doctor.css';

const HEALTHY_REPORT = Object.freeze({
  status: 'healthy', findings: [], repairableCount: 0, reviewCount: 0,
});

export default function ProjectIntegrityDoctor({
  report = HEALTHY_REPORT,
  onRepair,
  onAction,
}) {
  const findings = report.findings || [];
  const repairable = findings.filter(item => item.repair?.safety === 'safe');
  const heading = report.status === 'healthy'
    ? 'Project graph is coherent'
    : repairable.length
      ? 'Safe repairs are available'
      : 'Manual review is required';

  return (
    <section className={`project-integrity-doctor is-${report.status}`} aria-labelledby="project-integrity-title">
      <div className="project-integrity-doctor__header">
        <div>
          <Type variant="eyebrow" className="workflow-eyebrow">Project integrity</Type>
          <Type as="h3" variant="section-title" id="project-integrity-title">{heading}</Type>
          <p>Checks relationships that cross clones, Build Menus, stored weapons, and generated project records.</p>
        </div>
        <div className="project-integrity-doctor__metrics" aria-label="Integrity summary">
          <span><strong>{findings.length}</strong> findings</span>
          <span><strong>{report.repairableCount || 0}</strong> safe repairs</span>
          <span><strong>{report.reviewCount || 0}</strong> decisions</span>
        </div>
      </div>

      {findings.length === 0 ? (
        <EmptyState
          compact
          className="project-integrity-doctor__empty"
          title="No integrity drift detected"
          description="Every checked project reference resolves and synchronized workspaces agree."
        />
      ) : (
        <div className="project-integrity-doctor__findings" aria-live="polite">
          {findings.map(item => (
            <article className={`project-integrity-finding is-${item.severity}`} key={item.id}>
              <div className="project-integrity-finding__copy">
                <span>{item.category}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              <div className="project-integrity-finding__actions">
                {item.action && (
                  <Button size="small" onClick={() => onAction?.(item.action)}>{item.action.label}</Button>
                )}
                {item.repair?.safety === 'safe' && (
                  <Button size="small" variant="primary" onClick={() => onRepair?.([item.repair.id])}>
                    {item.repair.label}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {repairable.length > 0 && (
        <footer className="project-integrity-doctor__footer">
          <p>Safe repairs preserve valid choices, avoid guessing gameplay intent, and are recorded as one undoable project change.</p>
          <Button variant="primary" onClick={() => onRepair?.([])}>Repair all safe issues</Button>
        </footer>
      )}
    </section>
  );
}
