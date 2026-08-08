const cleanId = value => String(value || '').trim().toLowerCase();

export function getSupportingWeaponDefDestination(definition) {
  return `${cleanId(definition?.ownerUnitId)}:${cleanId(definition?.key)}`;
}

export function analyzeSupportingWeaponDefLibrary({
  definitions = [],
  knownUnitIds = [],
  tweaks = {},
} = {}) {
  const knownUnits = new Set(knownUnitIds.map(unit => cleanId(unit?.id || unit)));
  const destinations = definitions.map(getSupportingWeaponDefDestination);
  const destinationCounts = destinations.reduce((counts, destination) => {
    counts.set(destination, (counts.get(destination) || 0) + 1);
    return counts;
  }, new Map());
  const destinationSet = new Set(destinations);

  const entries = definitions.map((definition, index) => {
    const ownerUnitId = cleanId(definition.ownerUnitId);
    const key = cleanId(definition.key);
    const destination = destinations[index];
    const errors = [];
    const warnings = [];
    const consumers = new Set((definition.referencedBy || []).map(value => cleanId(value)).filter(Boolean));
    const dependencies = [...new Set((definition.dependencies || []).map(value => cleanId(value)).filter(Boolean))];

    if (!ownerUnitId) errors.push('Owner UnitDef is required.');
    else if (!knownUnits.has(ownerUnitId)) errors.push(`Owner UnitDef ${ownerUnitId} is not present in this project.`);
    if (!key) errors.push('WeaponDef key is required.');
    if (!definition.definition || typeof definition.definition !== 'object' || Array.isArray(definition.definition)) {
      errors.push('Literal definition must be a JSON object.');
    }
    if (destinationCounts.get(destination) > 1) errors.push('Another supporting WeaponDef uses this owner and key.');

    const missingDependencies = dependencies.filter(dependency => !destinationSet.has(`${ownerUnitId}:${dependency}`));
    if (missingDependencies.length) warnings.push(`Missing dependencies: ${missingDependencies.join(', ')}.`);

    definitions.forEach(candidate => {
      if (cleanId(candidate.ownerUnitId) !== ownerUnitId) return;
      const candidateDependencies = (candidate.dependencies || []).map(value => cleanId(value));
      if (candidateDependencies.includes(key)) consumers.add(cleanId(candidate.key));
    });
    (definition.mountedSlots || []).forEach(slot => consumers.add(`weapon slot ${slot}`));
    Object.entries(tweaks[ownerUnitId] || {}).forEach(([parameter, value]) => {
      if (cleanId(value) === key && /weapon_slot_\d+_/.test(parameter)) consumers.add(parameter.replaceAll('_', ' '));
    });

    if (!errors.length && !consumers.size) warnings.push('No project consumer currently references this definition.');
    const enabled = definition.enabled !== false;
    const status = errors.length ? 'error' : !enabled ? 'disabled' : warnings.length ? 'review' : 'ready';
    const definitionJson = JSON.stringify(definition.definition || {});

    return {
      ...definition,
      ownerUnitId,
      key,
      destination,
      enabled,
      status,
      errors,
      warnings,
      dependencies,
      missingDependencies,
      consumers: [...consumers],
      rootFieldCount: Object.keys(definition.definition || {}).length,
      encodedBytes: new TextEncoder().encode(definitionJson).byteLength,
    };
  });

  return {
    entries,
    totals: {
      all: entries.length,
      active: entries.filter(entry => entry.enabled).length,
      ready: entries.filter(entry => entry.status === 'ready').length,
      issues: entries.filter(entry => entry.status === 'error' || entry.status === 'review').length,
      unused: entries.filter(entry => entry.warnings.some(warning => warning.startsWith('No project consumer'))).length,
      bytes: entries.reduce((total, entry) => total + entry.encodedBytes, 0),
    },
  };
}
