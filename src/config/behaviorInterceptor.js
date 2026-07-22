export const INTERCEPTION_CHANNELS = Object.freeze([
  { bit: 1, label: '01', description: 'BAR strategic projectile channel' },
  { bit: 2, label: '02', description: 'Custom interception channel 2' },
  { bit: 4, label: '03', description: 'Custom interception channel 3' },
  { bit: 8, label: '04', description: 'Custom interception channel 4' },
  { bit: 16, label: '05', description: 'Custom interception channel 5' },
  { bit: 32, label: '06', description: 'Custom interception channel 6' },
  { bit: 64, label: '07', description: 'Custom interception channel 7' },
  { bit: 128, label: '08', description: 'Custom interception channel 8' },
]);

export const INTERCEPTION_ROLE_PRESETS = Object.freeze([
  {
    id: 'standard',
    label: 'Standard',
    description: 'Ordinary projectile with no interception role.',
    targetable: 0,
    interceptor: 0,
  },
  {
    id: 'targetable',
    label: 'Interceptable',
    description: 'Projectile can be acquired by matching interceptor weapons.',
    targetable: 1,
    interceptor: 0,
  },
  {
    id: 'interceptor',
    label: 'Interceptor',
    description: 'Weapon searches for and destroys matching projectiles.',
    targetable: 0,
    interceptor: 1,
  },
  {
    id: 'dual',
    label: 'Dual role',
    description: 'Projectile can intercept and can itself be intercepted.',
    targetable: 1,
    interceptor: 1,
  },
]);

export const UNIT_BEHAVIOR_CONTROLS = Object.freeze([
  { key: 'canattack', label: 'Can attack', type: 'boolean', description: 'Allows the unit to receive normal attack orders.' },
  { key: 'noautofire', label: 'Disable auto fire', type: 'boolean', description: 'Stops automatic weapon firing while preserving explicit control.' },
  { key: 'canmanualfire', label: 'Manual-fire command', type: 'boolean', description: 'Exposes the unit-level manual-fire command when supported.' },
  {
    key: 'firestate',
    label: 'Default fire state',
    type: 'select',
    description: 'Initial engagement posture when the unit is created.',
    options: [
      { value: 0, label: 'Hold fire' },
      { value: 1, label: 'Return fire' },
      { value: 2, label: 'Fire at will' },
    ],
  },
  {
    key: 'movestate',
    label: 'Default move state',
    type: 'select',
    description: 'Initial pursuit posture when the unit is created.',
    options: [
      { value: 0, label: 'Hold position' },
      { value: 1, label: 'Maneuver' },
      { value: 2, label: 'Roam' },
    ],
  },
  { key: 'nochasecategory', label: 'Do not chase', type: 'text', description: 'Space-separated unit categories this unit should not pursue.' },
]);

export function normalizeInterceptionMask(value) {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(0x7fffffff, Math.trunc(parsed)));
}

export function toggleInterceptionChannel(mask, bit) {
  const normalizedMask = normalizeInterceptionMask(mask);
  const normalizedBit = normalizeInterceptionMask(bit);
  if (normalizedBit === 0 || (normalizedBit & (normalizedBit - 1)) !== 0) return normalizedMask;
  return (normalizedMask & normalizedBit) !== 0
    ? normalizedMask & ~normalizedBit
    : normalizedMask | normalizedBit;
}

export function getInterceptionRole(targetable, interceptor) {
  const targetMask = normalizeInterceptionMask(targetable);
  const interceptorMask = normalizeInterceptionMask(interceptor);
  if (targetMask > 0 && interceptorMask > 0) return 'dual';
  if (targetMask > 0) return 'targetable';
  if (interceptorMask > 0) return 'interceptor';
  return 'standard';
}

export function getInterceptionDiagnostics({
  targetable,
  interceptor,
  coverage,
  range,
  knownTargetableMask = 0,
}) {
  const targetMask = normalizeInterceptionMask(targetable);
  const interceptorMask = normalizeInterceptionMask(interceptor);
  const knownMask = normalizeInterceptionMask(knownTargetableMask);
  const parsedCoverage = Number(coverage);
  const parsedRange = Number(range);
  const matchedKnownMask = interceptorMask & knownMask;
  const messages = [];

  if (interceptorMask > 0 && (!Number.isFinite(parsedCoverage) || parsedCoverage <= 0)) {
    messages.push({ level: 'error', code: 'coverage-missing', message: 'Interceptor weapons need a positive coverage radius.' });
  }
  if (interceptorMask > 0 && Number.isFinite(parsedCoverage) && Number.isFinite(parsedRange) && parsedCoverage < parsedRange) {
    messages.push({ level: 'warning', code: 'coverage-below-range', message: 'Coverage is smaller than weapon range, so acquisition ends before maximum reach.' });
  }
  if (interceptorMask > 0 && knownMask > 0 && matchedKnownMask === 0) {
    messages.push({ level: 'warning', code: 'no-known-match', message: 'This interceptor mask does not match a targetable projectile channel in the bundled BAR snapshot.' });
  }
  if (targetMask > 0 && interceptorMask > 0 && (targetMask & interceptorMask) !== 0) {
    messages.push({ level: 'info', code: 'self-compatible', message: 'The projectile and interceptor masks share a channel; this is a dual-role setup.' });
  }
  if (targetMask === 0 && interceptorMask === 0) {
    messages.push({ level: 'neutral', code: 'standard', message: 'No projectile-interception role is active.' });
  }
  if (messages.length === 0) {
    messages.push({ level: 'success', code: 'ready', message: 'Interception masks and acquisition coverage are coherent.' });
  }

  return {
    role: getInterceptionRole(targetMask, interceptorMask),
    targetableMask: targetMask,
    interceptorMask,
    matchedKnownMask,
    messages,
  };
}

export function collectKnownTargetableMask(defaultsDb = {}) {
  return Object.values(defaultsDb).reduce((mask, unit) => (
    (unit.weaponSlots || []).reduce((unitMask, slot) => (
      unitMask | normalizeInterceptionMask(slot.targetable)
    ), mask)
  ), 0);
}
