import { cx } from './utils.js';

export function SectionHeader({ eyebrow, title, description, actions, className, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  return (
    <header className={cx('ui-section-header', className)}>
      <div className="ui-section-header__copy">
        {eyebrow && <span className="ui-section-header__eyebrow">{eyebrow}</span>}
        <Heading>{title}</Heading>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ui-section-header__actions">{actions}</div>}
    </header>
  );
}

export function PageShell({ children, className, label }) {
  return <main className={cx('ui-page-shell', className)} aria-label={label}>{children}</main>;
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
