import categoriesDb from '../data/unit-categories.json';

const Ee = {
  leggatet3: ['buildings']
};

const Be = ['t4', 't3', 'boss'];

function Ve(e) {
  const t = e.toLowerCase();
  for (const n of Be) {
    if (t.endsWith(n) && e.length > n.length) {
      return e.slice(0, -n.length);
    }
  }
  return null;
}

function He(e) {
  const trimId = e.trim().toLowerCase();
  if (Ee[trimId]) return [...Ee[trimId]];
  
  const basic = categoriesDb[trimId];
  if (basic && Array.isArray(basic)) return [...basic];
  
  const stripped = Ve(trimId);
  if (stripped) {
    const strippedBasic = categoriesDb[stripped];
    if (strippedBasic && Array.isArray(strippedBasic)) return [...strippedBasic];
  }
  
  return [];
}

export function getFactionOfUnit(unitId) {
  const t = unitId.toLowerCase();
  if (t.includes('raptor') || t.includes('acid')) return 'rap';
  if (t.includes('scav')) return 'scav';
  const n = t.slice(0, 3);
  if (n === 'arm') return 'arm';
  if (n === 'cor') return 'cor';
  if (n === 'leg') return 'leg';
  return 'other';
}

export function getTechTierFromValue(lvl) {
  let n = null;
  if (typeof lvl === 'number' && Number.isFinite(lvl)) {
    n = Math.floor(lvl);
  } else if (typeof lvl === 'string' && lvl.trim() !== '') {
    const num = Number(lvl);
    if (Number.isFinite(num)) n = Math.floor(num);
  }
  if (n === null || n <= 1) return 't1';
  if (n === 2) return 't2';
  if (n === 3) return 't3';
  if (n >= 4) return 't4';
  return 't1';
}

export function getTechTierOfUnit(unitId, defaultsDb = {}) {
  const defaultData = defaultsDb[unitId];
  if (!defaultData) return 't1';
  return getTechTierFromValue(defaultData['customparams.techlevel']);
}

export function getTagsOfUnit(unitId, defaultsDb = {}) {
  const baseTags = He(unitId);
  const techTag = getTechTierOfUnit(unitId, defaultsDb);
  return [...baseTags, techTag];
}
