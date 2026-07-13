import { forwardRef } from 'react';
import { cx } from './utils.js';

export const Button = forwardRef(function Button({
  className,
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leadingIcon,
  trailingIcon,
  children,
  type = 'button',
  disabled,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth && 'ui-button--full',
        loading && 'is-loading',
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="ui-spinner ui-spinner--sm" aria-hidden="true" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton({ label, children, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      className={cx('ui-icon-button', className)}
      aria-label={label}
      title={props.title || label}
      {...props}
    >
      <span className="ui-icon-button__glyph" aria-hidden="true">{children}</span>
    </Button>
  );
});

export function ButtonGroup({ children, className, label }) {
  return <div className={cx('ui-button-group', className)} role="group" aria-label={label}>{children}</div>;
}

export function FileButton({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  accept,
  onChange,
  multiple = false,
  disabled = false,
  ...props
}) {
  return (
    <label className={cx('ui-button', `ui-button--${variant}`, `ui-button--${size}`, 'ui-file-button', disabled && 'is-disabled', className)} {...props}>
      {children}
      <input type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={onChange} />
    </label>
  );
}
