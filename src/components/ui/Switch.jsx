import { forwardRef, useId } from 'react';
import { cx } from './utils.js';

export const Switch = forwardRef(function Switch({
  checked,
  onChange,
  label,
  className,
  disabled = false,
  children,
  id,
  ...props
}, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <label className={cx('ui-switch', disabled && 'is-disabled', className)} htmlFor={inputId}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        {...props}
      />
      <span className="ui-switch-track" aria-hidden="true"><span className="ui-switch-thumb" /></span>
      {children}
    </label>
  );
});

export function SwitchField({ label, description, className, ...props }) {
  return (
    <Switch className={cx('ui-switch-field', className)} label={label} {...props}>
      <span className="ui-switch-field__copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </Switch>
  );
}
