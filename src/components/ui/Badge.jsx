import { cx } from './utils.js';

export function Badge({ children, tone = 'neutral', size = 'md', className, ...props }) {
  return <span className={cx('ui-badge', `ui-badge--${tone}`, `ui-badge--${size}`, className)} {...props}>{children}</span>;
}

export function StatusBadge({ status = 'neutral', children, className, ...props }) {
  return (
    <Badge tone={status} className={cx('ui-status-badge', className)} {...props}>
      <span className="ui-status-badge__dot" aria-hidden="true" />{children}
    </Badge>
  );
}
