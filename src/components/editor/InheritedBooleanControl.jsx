function normalizeBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

function getInheritedLabel(value) {
  const normalized = normalizeBoolean(value);
  if (normalized === true) return 'Inherited · Enabled';
  if (normalized === false) return 'Inherited · Disabled';
  return 'Inherited · Engine default';
}

export default function InheritedBooleanControl({ label, inheritedValue, modified, value, onChange }) {
  const normalizedValue = normalizeBoolean(value);
  const selectedValue = modified && normalizedValue !== undefined ? String(normalizedValue) : '';

  return (
    <select
      className={`stat-card-input inherited-boolean-control ${modified ? 'is-overridden' : 'is-inherited'}`}
      aria-label={`${label} override`}
      value={selectedValue}
      onChange={event => {
        if (event.target.value === '') onChange(undefined);
        else onChange(event.target.value === 'true');
      }}
    >
      <option value="">{getInheritedLabel(inheritedValue)}</option>
      <option value="true">Enabled</option>
      <option value="false">Disabled</option>
    </select>
  );
}
