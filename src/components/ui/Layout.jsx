import { cx } from './utils.js';
import { CapabilityLabels } from './CapabilityBadge.jsx';
import { Type } from './Typography.jsx';
import { MotionPage } from './Motion.jsx';

export function SectionHeader({ eyebrow, title, description, actions, className, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  return (
    <header className={cx('ui-section-header', className)}>
      <div className="ui-section-header__copy">
        {eyebrow && <Type variant="eyebrow" className="ui-section-header__eyebrow">{eyebrow}</Type>}
        <Type as={Heading} variant="section-title">{title}</Type>
        {description && <Type as="p" variant="description">{description}</Type>}
      </div>
      {actions && <div className="ui-section-header__actions">{actions}</div>}
    </header>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  capabilityId,
  capabilityIds,
  context,
  metrics = [],
  status,
  actions,
  className,
  headingId,
  headingLevel = 2,
}) {
  const Heading = `h${headingLevel}`;
  const hasUtilityRail = context || metrics.length > 0 || status || actions;

  return (
    <header className={cx('ui-page-header', className)}>
      <div className="ui-page-header__copy">
        <div className="ui-page-header__overline">
          {eyebrow && <Type variant="eyebrow">{eyebrow}</Type>}
          <CapabilityLabels featureId={capabilityId} capabilityIds={capabilityIds} compact />
        </div>
        <Type as={Heading} variant="page-title" id={headingId}>{title}</Type>
        {description && <Type as="p" variant="description">{description}</Type>}
      </div>
      {hasUtilityRail && (
        <div className="ui-page-header__utility">
          {context && <div className="ui-page-header__context">{context}</div>}
          {metrics.length > 0 && (
            <dl className="ui-page-header__metrics">
              {metrics.map(metric => (
                <div key={metric.label}>
                  <Type as="dt" variant="metadata">{metric.label}</Type>
                  <Type as="dd" variant="section-title">{metric.value}</Type>
                  {metric.detail && <Type as="small" variant="technical">{metric.detail}</Type>}
                </div>
              ))}
            </dl>
          )}
          {status && <div className="ui-page-header__status">{status}</div>}
          {actions && <div className="ui-page-header__actions">{actions}</div>}
        </div>
      )}
    </header>
  );
}

export function PageShell({
  children,
  className,
  label,
  eyebrow,
  title,
  description,
  capabilityId,
  capabilityIds,
  context,
  metrics,
  status,
  actions,
  header,
  toolbar,
  footer,
  bodyClassName,
  headingId,
  headingLevel = 2,
  scrollMode = 'contained',
}) {
  const resolvedHeadingId = headingId || (title ? `page-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined);
  const accessibleProps = resolvedHeadingId
    ? { 'aria-labelledby': resolvedHeadingId }
    : { 'aria-label': label };

  return (
    <MotionPage className={cx('ui-page-shell', `ui-page-shell--${scrollMode}`, className)} {...accessibleProps}>
      {header || (title && (
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          capabilityId={capabilityId}
          capabilityIds={capabilityIds}
          context={context}
          metrics={metrics}
          status={status}
          actions={actions}
          headingId={resolvedHeadingId}
          headingLevel={headingLevel}
        />
      ))}
      {toolbar && <div className="ui-page-shell__toolbar">{toolbar}</div>}
      <div className={cx('ui-page-shell__body', bodyClassName)}>{children}</div>
      {footer && <footer className="ui-page-shell__footer">{footer}</footer>}
    </MotionPage>
  );
}

export function Card({ children, className, tone = 'default', padding = 'md', as: Element = 'div', ...props }) {
  return <Element className={cx('ui-card', `ui-card--${tone}`, `ui-card--padding-${padding}`, className)} {...props}>{children}</Element>;
}

export function StatCard({ modified = false, compact = false, children, className, ...props }) {
  return (
    <div className={cx('stat-card', modified && 'modified', compact && 'stat-card--compact', className)} {...props}>
      {children}
    </div>
  );
}

export function Divider({ label, className }) {
  return <div className={cx('ui-divider', className)} role="separator">{label && <span>{label}</span>}</div>;
}
