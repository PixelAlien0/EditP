export const BARBARIAN_AI_CONTRACT_VERSION = 1;

export const BARBARIAN_PROFILE_SURFACES = Object.freeze([
  Object.freeze({ id: 'behaviour', label: 'Behaviour', aliases: ['behavior'], description: 'Squad roles, target selection, movement posture, and attack behavior.' }),
  Object.freeze({ id: 'block_map', label: 'Block map', aliases: ['blockmap'], description: 'Map occupancy, placement blocking, and terrain-aware planning.' }),
  Object.freeze({ id: 'build_chain', label: 'Build chain', aliases: ['buildchain'], description: 'Factory, builder, economy, and technology construction routes.' }),
  Object.freeze({ id: 'commander', label: 'Commander', aliases: ['commander_behaviour'], description: 'Commander opening, retreat, upgrade, and support policy.' }),
  Object.freeze({ id: 'economy', label: 'Economy', aliases: ['eco'], description: 'Resource thresholds, storage targets, and spending policy.' }),
  Object.freeze({ id: 'factory', label: 'Factory', aliases: ['factories'], description: 'Factory selection, unit production weighting, and role composition.' }),
  Object.freeze({ id: 'response', label: 'Response', aliases: ['responses'], description: 'Threat reactions, counter selection, defense, and reinforcement policy.' }),
]);

export const BARBARIAN_OPTION_KEYS = Object.freeze([
  'profile',
  'game_config',
  'cheating',
  'comm_merge',
  'ally_base',
  'disabledunits',
]);

export const BARBARIAN_PACKAGE_FILES = Object.freeze([
  Object.freeze({ id: 'ai-info', label: 'AI identity', pattern: /(^|\/)aiinfo\.lua$/i, required: true }),
  Object.freeze({ id: 'ai-options', label: 'Lobby options', pattern: /(^|\/)aioptions\.lua$/i, required: false }),
  Object.freeze({ id: 'config', label: 'Profile data', pattern: /\.(json|jsonc)$/i, required: false }),
  Object.freeze({ id: 'script', label: 'AI script', pattern: /\.(as|lua)$/i, required: false }),
  Object.freeze({ id: 'native', label: 'Native runtime', pattern: /\.(dll|so|dylib)$/i, required: false }),
]);

export const CURRENT_BARBARIAN_CONTRACT = Object.freeze({
  id: 'barbarian-ai-package',
  version: BARBARIAN_AI_CONTRACT_VERSION,
  label: 'BARbarIAn package contract',
  profileSurfaces: BARBARIAN_PROFILE_SURFACES,
  optionKeys: BARBARIAN_OPTION_KEYS,
  packageFiles: BARBARIAN_PACKAGE_FILES,
  compatibilityStatuses: Object.freeze(['compatible', 'changed', 'removed', 'experimental', 'unknown']),
});

