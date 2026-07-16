function optionLine(key, value) {
  return `    ${key} = ${value};`;
}

/**
 * Generate a Spring/Recoil startscript fragment for headless/dev launches.
 * forceallunits must be present before UnitDefs are assembled; tweakdefs Lua
 * cannot enable it after the fact.
 */
export function generateStartscriptGameOptions({
  forceAllUnits = false,
  tweakDefsBase64 = '',
  tweakUnitsBase64 = '',
} = {}) {
  const lines = [optionLine('forceallunits', forceAllUnits ? '1' : '0')];
  if (tweakDefsBase64) lines.push(optionLine('tweakdefs', tweakDefsBase64));
  if (tweakUnitsBase64) lines.push(optionLine('tweakunits', tweakUnitsBase64));
  return ['[GAME]', '{', '  [MODOPTIONS]', '  {', ...lines, '  }', '}'].join('\n');
}
