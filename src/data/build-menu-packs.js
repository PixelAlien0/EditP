// Build-option additions mirrored from BAR's unitbasedefs pack rules.
// Source: Beyond-All-Reason @ fccd427dac837100f56b8e97937653182f97e235
export const BUILD_MENU_PACK_SOURCE_COMMIT = 'fccd427dac837100f56b8e97937653182f97e235';

export const BUILD_MENU_PACKS = {
  extraUnits: {
    optionKey: 'experimentalextraunits',
    label: 'Extra Units Pack',
    description: 'PvP-balanced units outside the standard roster.',
    additions: {
      armcs: ['armgplat', 'armfrock'],
      armcsa: ['armgplat', 'armfrock'],
      armvp: ['armzapper'],
      armap: ['armfify'],
      armaca: ['armshockwave', 'armwint2', 'armnanotct2', 'armlwall', 'armgatet3'],
      armack: ['armshockwave', 'armwint2', 'armnanotct2', 'armlwall', 'armgatet3'],
      armacv: ['armshockwave', 'armwint2', 'armnanotct2', 'armlwall', 'armgatet3'],
      armacsub: ['armfgate', 'armnanotc2plat'],
      armasy: ['armexcalibur', 'armseadragon'],
      armshltx: ['armmeatball', 'armassimilator'],
      armshltxuw: ['armmeatball', 'armassimilator'],
      corcs: ['corgplat', 'corfrock'],
      corcsa: ['corgplat', 'corfrock'],
      coraca: ['corwint2', 'cornanotct2', 'cormwall', 'corgatet3'],
      corack: ['corwint2', 'cornanotct2', 'cormwall', 'corgatet3'],
      coracv: ['corwint2', 'cornanotct2', 'cormwall', 'corgatet3'],
      coracsub: ['corfgate', 'cornanotc2plat'],
      coralab: ['cordeadeye'],
      coravp: ['corvac', 'corphantom', 'corsiegebreaker', 'corforge', 'cortorch'],
      corasy: ['coresuppt3', 'coronager', 'cordesolator', 'corprince'],
      corgant: ['corves'],
      corgantuw: ['corves'],
      legaca: ['legwint2', 'legnanotct2', 'legrwall', 'leggatet3'],
      legack: ['legwint2', 'legnanotct2', 'legrwall', 'leggatet3'],
      legacv: ['legwint2', 'legnanotct2', 'legrwall', 'leggatet3'],
      leganavyconsub: ['corfgate', 'legnanotct2plat'],
      leggant: ['legbunk']
    }
  },
  scavengerUnits: {
    optionKey: 'scavunitsforplayers',
    label: 'Scavengers Units Pack',
    description: 'Epic and experimental Scavenger units; not PvP balanced.',
    additions: {
      armaca: ['armapt3', 'armminivulc', 'armbotrail', 'armannit3', 'armafust3', 'armmmkrt3'],
      armack: ['armapt3', 'armminivulc', 'armbotrail', 'armannit3', 'armafust3', 'armmmkrt3'],
      armacv: ['armapt3', 'armminivulc', 'armbotrail', 'armannit3', 'armafust3', 'armmmkrt3'],
      armasy: ['armdronecarry', 'armptt2', 'armdecadet3', 'armpshipt3', 'armserpt3', 'armtrident'],
      armshltx: ['armrattet4', 'armsptkt4', 'armpwt4', 'armvadert4', 'armdronecarryland'],
      armshltxuw: ['armrattet4', 'armsptkt4', 'armpwt4', 'armvadert4'],
      corlab: ['corkark'],
      coraca: ['corapt3', 'corminibuzz', 'corhllllt', 'cordoomt3', 'corafust3', 'cormmkrt3'],
      corack: ['corapt3', 'corminibuzz', 'corhllllt', 'cordoomt3', 'corafust3', 'cormmkrt3'],
      coracv: ['corapt3', 'corminibuzz', 'corhllllt', 'cordoomt3', 'corafust3', 'cormmkrt3'],
      coravp: ['corgatreap', 'corftiger'],
      coraap: ['corcrw'],
      corasy: ['cordronecarry', 'corslrpc', 'corsentinel'],
      corgant: ['corkarganetht4', 'corakt4', 'corthermite', 'cormandot4'],
      corgantuw: ['corkarganetht4', 'corakt4', 'cormandot4'],
      legaca: ['legapt3', 'legministarfall', 'legafust3', 'legadveconvt3'],
      legack: ['legapt3', 'legministarfall', 'legafust3', 'legadveconvt3'],
      legacv: ['legapt3', 'legministarfall', 'legafust3', 'legadveconvt3'],
      leggant: ['legsrailt4', 'leggobt3', 'legpede', 'legeheatraymech_old']
    }
  }
};

export function buildEffectiveFactoryRosters(baseRosters, enabledPacks) {
  const result = Object.fromEntries(
    Object.entries(baseRosters).map(([builderId, roster]) => [builderId, [...roster]])
  );

  Object.entries(BUILD_MENU_PACKS).forEach(([packId, pack]) => {
    if (!enabledPacks?.[packId]) return;
    Object.entries(pack.additions).forEach(([builderId, additions]) => {
      const roster = result[builderId] || (result[builderId] = []);
      const known = new Set(roster.map(unitId => unitId.toLowerCase()));
      additions.forEach(unitId => {
        if (!known.has(unitId.toLowerCase())) {
          roster.push(unitId);
          known.add(unitId.toLowerCase());
        }
      });
    });
  });

  return result;
}

export function getBuildMenuPackSource(builderId, unitId, enabledPacks) {
  for (const [packId, pack] of Object.entries(BUILD_MENU_PACKS)) {
    if (!enabledPacks?.[packId]) continue;
    if ((pack.additions[builderId] || []).some(id => id.toLowerCase() === unitId.toLowerCase())) {
      return packId;
    }
  }
  return null;
}
