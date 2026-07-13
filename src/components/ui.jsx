import { forwardRef } from 'react';

export const Button = forwardRef(function Button(
  { className = '', variant = 'secondary', children, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
});

export function Switch({ checked, onChange, label, className = '', disabled = false, children, ...props }) {
  return (
    <label className={`ui-switch ${className}`.trim()}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        {...props}
      />
      <span className="ui-switch-track" aria-hidden="true">
        <span className="ui-switch-thumb" />
      </span>
      {children}
    </label>
  );
}

export function SectionHeader({ eyebrow, title, description, actions, className = '' }) {
  return (
    <header className={`ui-section-header ${className}`.trim()}>
      <div>
        {eyebrow && <span className="ui-section-header__eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ui-section-header__actions">{actions}</div>}
    </header>
  );
}

export function PageShell({ children, className = '', label }) {
  return <main className={`ui-page-shell ${className}`.trim()} aria-label={label}>{children}</main>;
}

export function StatCard({ modified = false, compact = false, children, className = '', ...props }) {
  return (
    <div className={`stat-card ${modified ? 'modified' : ''} ${compact ? 'stat-card--compact' : ''} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
