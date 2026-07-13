export function cx(...values) {
  return values.flatMap(value => {
    if (!value) return [];
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return cx(...value).split(' ').filter(Boolean);
    if (typeof value === 'object') {
      return Object.entries(value).filter(([, enabled]) => Boolean(enabled)).map(([name]) => name);
    }
    return [];
  }).join(' ');
}
