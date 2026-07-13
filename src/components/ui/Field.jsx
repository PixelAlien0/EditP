import { cloneElement, isValidElement, useId } from 'react';
import { cx } from './utils.js';

export function Field({ label, description, error, required, className, children }) {
  const generatedId = useId();
  const childId = isValidElement(children) && children.props.id ? children.props.id : generatedId;
  const helpId = description || error ? `${childId}-help` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: childId,
        required: children.props.required ?? required,
        'aria-describedby': children.props['aria-describedby'] || helpId,
        'aria-invalid': error ? true : children.props['aria-invalid']
      })
    : children;

  return (
    <label className={cx('ui-field', error && 'has-error', className)} htmlFor={childId}>
      <span className="ui-field__label">{label}{required && <span aria-hidden="true"> *</span>}</span>
      {control}
      {(error || description) && (
        <small id={helpId} className={cx('ui-field__help', error && 'is-error')}>
          {error || description}
        </small>
      )}
    </label>
  );
}

export function TextField({ label, description, error, required, className, inputClassName, ...props }) {
  return (
    <Field label={label} description={description} error={error} required={required} className={className}>
      <input className={cx('ui-control', 'ui-input', inputClassName)} {...props} />
    </Field>
  );
}

export function TextAreaField({ label, description, error, required, className, inputClassName, ...props }) {
  return (
    <Field label={label} description={description} error={error} required={required} className={className}>
      <textarea className={cx('ui-control', 'ui-textarea', inputClassName)} {...props} />
    </Field>
  );
}

export function SelectField({ label, description, error, required, className, inputClassName, children, ...props }) {
  return (
    <Field label={label} description={description} error={error} required={required} className={className}>
      <select className={cx('ui-control', 'ui-select', inputClassName)} {...props}>{children}</select>
    </Field>
  );
}
