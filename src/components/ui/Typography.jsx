import { cx } from './utils.js';

const VALID_VARIANTS = new Set([
  'eyebrow',
  'page-title',
  'section-title',
  'subsection-title',
  'description',
  'body',
  'technical',
  'metadata',
]);

export function Type({
  as: Element = 'span',
  variant = 'body',
  className,
  children,
  ...props
}) {
  const resolvedVariant = VALID_VARIANTS.has(variant) ? variant : 'body';
  return (
    <Element
      className={cx('ui-type', `ui-type--${resolvedVariant}`, className)}
      {...props}
    >
      {children}
    </Element>
  );
}

export function Eyebrow(props) {
  return <Type variant="eyebrow" {...props} />;
}

export function TechnicalText(props) {
  return <Type variant="technical" {...props} />;
}
