import { cx } from './utils.js';

export function Spinner({ size = 'md', label = 'Loading', className }) {
  return <span className={cx('ui-spinner', `ui-spinner--${size}`, className)} role="status"><span className="ui-visually-hidden">{label}</span></span>;
}

export function EmptyState({ title, description, action, compact = false, className, icon }) {
  return (
    <div className={cx('ui-empty-state', compact && 'is-compact', className)}>
      {icon && <span className="ui-empty-state__icon" aria-hidden="true">{icon}</span>}
      <strong>{title}</strong>
      {description && <span>{description}</span>}
      {action && <div className="ui-empty-state__action">{action}</div>}
    </div>
  );
}

export function Callout({ title, children, tone = 'info', className, actions, ...props }) {
  return (
    <div className={cx('ui-callout', `ui-callout--${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'} {...props}>
      <div className="ui-callout__copy">{title && <strong>{title}</strong>}<span>{children}</span></div>
      {actions && <div className="ui-callout__actions">{actions}</div>}
    </div>
  );
}
