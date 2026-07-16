function optionLine(key, value) {
  return `  ${key} = ${value};`;
}

/**
 * Generate the MODOPTIONS section used by a Spring/Recoil startscript.
 * forceallunits must be present before UnitDefs are assembled; tweakdefs Lua
 * cannot enable it after the fact.
 */
export function generateLobbyModOptions({
  forceAllUnits = false,
  tweakDefsBase64 = '',
  tweakUnitsBase64 = '',
} = {}) {
  const lines = [optionLine('forceallunits', forceAllUnits ? 'true' : 'false')];
  if (tweakDefsBase64) lines.push(optionLine('tweakdefs', tweakDefsBase64));
  if (tweakUnitsBase64) lines.push(optionLine('tweakunits', tweakUnitsBase64));
  return ['[MODOPTIONS]', '{', ...lines, '}'].join('\n');
}

