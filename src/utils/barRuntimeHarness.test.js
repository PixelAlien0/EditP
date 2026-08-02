import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  assertRuntimeCompatibility,
  evaluateRuntimeExpectations,
  executeCompiledBarModules,
} from '../../scripts/lib/bar-runtime-harness.mjs';
import { useCompiledProjectOutputs } from '../hooks/useCompiledProjectOutputs.js';
import { ADVANCED_MECHANICS_RUNTIME_FIXTURES } from './fixtures/advancedMechanicsRuntimeFixtures.js';
import { compileLobbyModules } from './lobbyModules.js';
import { serializeLuaTable } from './tweakSerializer.js';
import { compileTweakDefsLua } from './tweakdefsHelper.js';

const baseArmflash = {
  name: 'Flash',
  description: 'Fast assault tank',
  health: 100,
  customparams: { unitgroup: 'weapon' },
  buildoptions: [],
  weapons: [{ def: 'LASER', onlytargetcategory: 'SURFACE' }],
  weapondefs: {
    laser: {
      range: 300,
      reloadtime: 1,
      damage: { default: 50 },
      customparams: {},
    },
  },
};

function generatedPackage({
  clones = [],
  buildMenuSteps = [],
  tweaks = {},
  supportingWeaponDefs = [],
  deathExplosionTweaks = [],
  units = {},
} = {}) {
  const generatedTweakDefsLua = compileTweakDefsLua({
    currentTweakDefsLua: '',
    customUnitClones: clones,
    buildMenuWizardSteps: buildMenuSteps,
    disabledUnitIds: [],
    unitBuildOptions: { armlab: ['armflash'] },
    projectMeta: null,
    compileFlags: { includeClones: true, includeRosters: true },
    weaponLibrary: [],
    deathExplosionTweaks,
    supportingWeaponDefs,
    tweaks,
  });
  return compileLobbyModules({
    tweakModules: [],
    generatedTweakDefsLua,
    generatedTweakUnitsLua: serializeLuaTable(units),
    base64Options: { padding: false },
  });
}

function compileAdvancedMechanicsFixture(fixture) {
  const { result } = renderHook(() => useCompiledProjectOutputs({
    tweaks: fixture.tweaks || {},
    allUnitsList: fixture.units || [],
    clones: fixture.clones || [],
    defaultsDb: fixture.defaultsDb || {},
    explosionProfiles: fixture.explosionProfiles || {},
    resolveCloneRootId: unitId => fixture.cloneRoots?.[unitId] || unitId,
    getInheritedCloneWeaponSwaps: unitId => fixture.weaponSwaps?.[unitId] || {},
    includeTweaks: true,
    includeClones: true,
    includeRosters: true,
    includeHeader: false,
    tweakDefsLua: '',
    buildMenuSteps: [],
    disabledUnitIds: [],
    activeFactoryRosters: {},
    projectName: 'Advanced mechanics runtime fixture',
    projectAuthor: '',
    projectDesc: '',
    weaponLibrary: [],
    supportingWeaponDefs: fixture.supportingWeaponDefs || [],
    tweakModules: [],
    base64Options: { padding: false },
  }));
  return result.current.compiledLobbyModules;
}

describe('BAR runtime compatibility harness', () => {
  it('preserves shield-orb and advanced/epic-fusion visual dependencies on clones', () => {
    const visualSources = {
      armgate: {
        objectname: 'Units/ARMGATE.s3o',
        script: 'Units/ARMGATE.cob',
        buildpic: 'ARMGATE.DDS',
        sfxtypes: { explosiongenerators: ['custom:shield_orb'] },
        sounds: { select: ['arm-bld-shield'] },
        corpse: 'DEAD',
        featuredefs: { dead: { object: 'Units/armgate_dead.s3o' } },
        weapons: [{ def: 'REPULSOR' }],
        weapondefs: { repulsor: { shield: { radius: 550, power: 6175 } } },
        customparams: { normaltex: 'unittextures/Arm_normal.dds', unitgroup: 'util' },
      },
      armafust3: {
        objectname: 'Units/ARMAFUST3.s3o',
        script: 'Units/ARMAFUS.cob',
        buildpic: 'ARMAFUS.DDS',
        customparams: { normaltex: 'unittextures/Arm_normal.dds', unitgroup: 'energy' },
      },
      corafust3: {
        objectname: 'Units/CORAFUST3.s3o',
        script: 'Units/CORAFUS.cob',
        buildpic: 'CORAFUS.DDS',
        customparams: { normaltex: 'unittextures/cor_normal.dds', unitgroup: 'energy' },
      },
      legafust3: {
        objectname: 'Units/LEGAFUST3.s3o',
        script: 'Units/LEGAFUS.cob',
        buildpic: 'LEGAFUS.DDS',
        customparams: { normaltex: 'unittextures/leg_normal.dds', unitgroup: 'energy' },
      },
      scav_armafust3: {
        objectname: 'Units/SCAV_ARMAFUST3.s3o',
        script: 'Units/SCAV_ARMAFUS.cob',
        buildpic: 'scavengers/ARMAFUS.DDS',
        customparams: { normaltex: 'unittextures/scav_normal.dds', unitgroup: 'energy' },
      },
    };
    const clonePairs = [
      ['armgate', 'keeper_orb_clone'],
      ['armafust3', 'arm_epic_fusion_clone'],
      ['corafust3', 'cor_epic_fusion_clone'],
      ['legafust3', 'leg_epic_fusion_clone'],
      ['scav_armafust3', 'scav_epic_fusion_clone'],
    ];
    const compiled = generatedPackage({
      clones: clonePairs.map(([baseId, newId]) => ({ baseId, newId, displayName: newId, builderIds: [] })),
    });
    const result = executeCompiledBarModules(compiled, { unitDefs: visualSources });

    assertRuntimeCompatibility(result, {
      unitsExist: clonePairs.map(([, newId]) => newId),
      paths: [
        { path: 'keeper_orb_clone.objectname', equals: 'Units/ARMGATE.s3o' },
        { path: 'keeper_orb_clone.script', equals: 'Units/ARMGATE.cob' },
        { path: 'keeper_orb_clone.weapondefs.repulsor.shield.radius', equals: 550 },
        { path: 'keeper_orb_clone.sfxtypes.explosiongenerators.0', equals: 'custom:shield_orb' },
        { path: 'arm_epic_fusion_clone.objectname', equals: 'Units/ARMAFUST3.s3o' },
        { path: 'arm_epic_fusion_clone.script', equals: 'Units/ARMAFUS.cob' },
        { path: 'cor_epic_fusion_clone.objectname', equals: 'Units/CORAFUST3.s3o' },
        { path: 'leg_epic_fusion_clone.objectname', equals: 'Units/LEGAFUST3.s3o' },
        { path: 'scav_epic_fusion_clone.objectname', equals: 'Units/SCAV_ARMAFUST3.s3o' },
        { path: 'scav_epic_fusion_clone.script', equals: 'Units/SCAV_ARMAFUS.cob' },
      ],
    });
  });

  it('executes nested clones, Units patches, and build-menu placement', () => {
    const compiled = generatedPackage({
      clones: [
        {
          baseId: 'editp_parent',
          newId: 'editp_child',
          displayName: 'Runtime Child',
          builderIds: ['armlab'],
        },
        {
          baseId: 'armflash',
          newId: 'editp_parent',
          displayName: 'Runtime Parent',
          builderIds: ['armlab'],
        },
      ],
      units: {
        editp_child: {
          health: 900,
          maxvelocity: 4.25,
        },
      },
    });
    const result = executeCompiledBarModules(compiled, {
      unitDefs: {
        armflash: baseArmflash,
        armlab: { name: 'Bot Lab', buildoptions: ['armflash'] },
      },
    });

    assertRuntimeCompatibility(result, {
      unitsExist: ['editp_parent', 'editp_child'],
      paths: [
        { path: 'editp_child.health', equals: 900 },
        { path: 'editp_child.maxvelocity', equals: 4.25 },
        { path: 'editp_child.customparams.i18n_en_humanname', equals: 'Runtime Child' },
      ],
      buildMenus: {
        armlab: {
          includes: ['armflash', 'editp_parent', 'editp_child'],
        },
      },
    });
    expect(result.execution.map(item => item.kind)).toEqual(['defs', 'units']);
  });

  it('edits the inherited build menu of a cloned factory producer', () => {
    const compiled = generatedPackage({
      clones: [{
        baseId: 'armavp',
        newId: 'tactical_assault_facility',
        displayName: 'Tactical Assault Facility',
        builderIds: [],
      }],
      buildMenuSteps: [{
        builderId: 'tactical_assault_facility',
        add: ['armflash'],
        remove: ['armmart'],
      }],
    });
    const result = executeCompiledBarModules(compiled, {
      unitDefs: {
        armavp: {
          name: 'Advanced Vehicle Plant',
          buildoptions: ['armbull', 'armmart'],
        },
        armbull: { name: 'Bull' },
        armmart: { name: 'Martyr' },
        armflash: baseArmflash,
      },
    });

    assertRuntimeCompatibility(result, {
      unitsExist: ['tactical_assault_facility'],
      buildMenus: {
        tactical_assault_facility: {
          includes: ['armbull', 'armflash'],
          excludes: ['armmart'],
        },
      },
    });
  });

  it('applies weapon edits, supporting definitions, and isolated death profiles', () => {
    const compiled = generatedPackage({
      clones: [{
        baseId: 'armflash',
        newId: 'editp_weapons',
        displayName: 'Runtime Weapons',
        builderIds: [],
        weaponSwaps: {
          1: { sourceUnitId: 'armflash', sourceWeaponDefKey: 'laser' },
        },
      }],
      tweaks: {
        editp_weapons: {
          weapon_slot_1_range: 525,
        },
      },
      units: {
        editp_weapons: {
          weapondefs: { laser: { range: 525 } },
        },
      },
      supportingWeaponDefs: [{
        id: 'runtime-cluster',
        ownerUnitId: 'editp_weapons',
        key: 'cluster_child',
        enabled: true,
        mode: 'replace',
        definition: {
          range: 180,
          damage: { default: 24 },
          customparams: { cluster_number: 3 },
        },
        mountedSlots: [2],
      }],
      deathExplosionTweaks: [{
        unitId: 'editp_weapons',
        explodeAs: 'runtimeExplosion',
        sources: {
          death: {
            definition: {
              areaofeffect: 96,
              damage: { default: 200 },
              customparams: { unitexplosion: 1 },
            },
          },
        },
        death: { damage: 4000, aoe: 360 },
      }],
    });
    const result = executeCompiledBarModules(compiled, {
      unitDefs: { armflash: baseArmflash },
    });

    assertRuntimeCompatibility(result, {
      unitsExist: ['editp_weapons'],
      paths: [
        { path: 'editp_weapons.weapondefs.laser.range', equals: 525 },
        { path: 'editp_weapons.weapondefs.cluster_child.damage.default', equals: 24 },
        { path: 'editp_weapons.weapondefs.editp_death.damage.default', equals: 4000 },
        { path: 'editp_weapons.weapondefs.editp_death.areaofeffect', equals: 360 },
        { path: 'editp_weapons.weapons.1.def', equals: 'CLUSTER_CHILD' },
        { path: 'editp_weapons.explodeas', equals: 'editp_death' },
      ],
    });
  });

  it('keeps Weapon Lab clones mounted and targets their generated WeaponDef with later edits', () => {
    const blueprint = {
      id: 'weapon_madsam_copy',
      name: 'MADSAM copy',
      sourceUnitId: 'cormadsam',
      sourceWeaponDefKey: 'madsam_missile',
      sourceValues: {},
      overrides: {},
    };
    const weaponSwap = {
      sourceUnitId: 'cormadsam',
      sourceWeaponDefKey: 'madsam_missile',
      libraryWeaponId: blueprint.id,
    };
    const { result: compiledOutput } = renderHook(() => useCompiledProjectOutputs({
      tweaks: {
        allmdt2: {
          weapon_slot_1_interceptor: 2,
          weapon_slot_1_targetable: 0,
          weapon_slot_1_coverage: 500,
          weapon_slot_1_range: 500,
        },
      },
      allUnitsList: [
        { id: 'allmdt2', name: 'Missile Defense', isClone: true },
        { id: 'cormadsam', name: 'MADSAM', isClone: false },
      ],
      clones: [{
        baseId: 'legapopupdef',
        newId: 'allmdt2',
        displayName: 'Missile Defense',
        builderIds: [],
        weaponSwaps: { 1: weaponSwap },
      }],
      defaultsDb: {
        legapopupdef: { weaponSlots: [{ slot: 1, defKey: 'advanced_riot_cannon' }] },
        cormadsam: { weaponSlots: [{ slot: 1, defKey: 'madsam_missile', range: 840 }] },
      },
      explosionProfiles: {},
      resolveCloneRootId: unitId => unitId === 'allmdt2' ? 'legapopupdef' : unitId,
      getInheritedCloneWeaponSwaps: unitId => unitId === 'allmdt2' ? { 1: weaponSwap } : {},
      includeTweaks: true,
      includeClones: true,
      includeRosters: true,
      includeHeader: false,
      tweakDefsLua: '',
      buildMenuSteps: [],
      disabledUnitIds: [],
      activeFactoryRosters: {},
      projectName: 'MADSAM runtime regression',
      projectAuthor: '',
      projectDesc: '',
      unitDescriptions: {},
      weaponLibrary: [blueprint],
      supportingWeaponDefs: [],
      tweakModules: [],
      base64Options: { padding: false },
    }));

    const runtime = executeCompiledBarModules(compiledOutput.current.compiledLobbyModules, {
      unitDefs: {
        legapopupdef: {
          weapons: [{ def: 'ADVANCED_RIOT_CANNON' }],
          weapondefs: { advanced_riot_cannon: { range: 600, damage: { default: 120 } } },
        },
        cormadsam: {
          weapons: [{ def: 'MADSAM_MISSILE', onlytargetcategory: 'VTOL' }],
          weapondefs: {
            madsam_missile: {
              range: 840,
              weaponvelocity: 1250,
              tracks: true,
              damage: { default: 0, vtol: 76 },
            },
          },
        },
      },
    });

    assertRuntimeCompatibility(runtime, {
      unitsExist: ['allmdt2'],
      paths: [
        { path: 'allmdt2.weapons.0.def', equals: 'EDITP_WEAPON_MADSAM_COPY' },
        { path: 'allmdt2.weapons.0.onlytargetcategory', equals: 'VTOL' },
        { path: 'allmdt2.weapondefs.editp_weapon_madsam_copy.interceptor', equals: 2 },
        { path: 'allmdt2.weapondefs.editp_weapon_madsam_copy.targetable', equals: 0 },
        { path: 'allmdt2.weapondefs.editp_weapon_madsam_copy.coverage', equals: 500 },
        { path: 'allmdt2.weapondefs.editp_weapon_madsam_copy.range', equals: 500 },
        { path: 'allmdt2.weapondefs.editp_weapon_madsam_copy.tracks', equals: true },
      ],
    });
    expect(runtime.unitDefs.allmdt2.weapondefs.madsam_missile).toBeUndefined();
  });

  it('materializes multi-drone carrier metadata on the selected WeaponDef', () => {
    const compiled = generatedPackage({
      tweaks: {
        editp_carrier: {
          editp_carrier_weapondef: 'dronegun',
          editp_carrier_roster: 'armdrone corvamp armflea',
          'customparams.carried_unit': 'armdrone',
          'customparams.maxunits': 8,
          'customparams.startingdronecount': 3,
          'customparams.droneammo': 6,
          'customparams.spawnrate': 4,
          'customparams.metalcost': 25,
          'customparams.energycost': 600,
          'customparams.enabledocking': false,
          'customparams.manualdrones': true,
          'customparams.carrierdeaththroe': 'release',
          'customparams.spawns_surface': 'LAND',
        },
      },
    });
    const result = executeCompiledBarModules(compiled, {
      unitDefs: {
        editp_carrier: {
          weapons: [{ def: 'DRONEGUN' }],
          weapondefs: {
            dronegun: {
              range: 500,
              customparams: { carried_unit: 'armdrone' },
            },
          },
        },
        armdrone: { health: 100 },
        corvamp: { health: 200 },
        armflea: { health: 50 },
      },
    });

    assertRuntimeCompatibility(result, {
      paths: [
        { path: 'editp_carrier.weapondefs.dronegun.customparams.carried_unit', equals: 'armdrone corvamp armflea' },
        { path: 'editp_carrier.weapondefs.dronegun.customparams.maxunits', equals: '8 8 8' },
        { path: 'editp_carrier.weapondefs.dronegun.customparams.startingdronecount', equals: '3 3 3' },
        { path: 'editp_carrier.weapondefs.dronegun.customparams.droneammo', equals: '6 6 6' },
        { path: 'editp_carrier.weapondefs.dronegun.customparams.spawnrate', equals: '4' },
        { path: 'editp_carrier.weapondefs.dronegun.customparams.enabledocking', equals: '0' },
        { path: 'editp_carrier.weapondefs.dronegun.customparams.manualdrones', equals: '1' },
        { path: 'editp_carrier.weapondefs.dronegun.customparams.carrierdeaththroe', equals: 'release' },
        { path: 'editp_carrier.weapondefs.dronegun.customparams.spawns_surface', equals: 'LAND' },
      ],
    });
  });

  it('reports expectation failures without mutating the runtime snapshot', () => {
    const result = {
      unitDefs: { armlab: { buildoptions: ['armflash'] } },
      weaponDefs: {},
    };
    const issues = evaluateRuntimeExpectations(result, {
      unitsExist: ['missing_clone'],
      buildMenus: { armlab: { includes: ['missing_clone'] } },
    });

    expect(issues.map(issue => issue.code)).toEqual([
      'UnitDefs-missing',
      'build-menu-unit-missing',
    ]);
    expect(result.unitDefs.armlab.buildoptions).toEqual(['armflash']);
  });

  it('rejects imported Lua unless execution is explicitly opted in', () => {
    const compiled = compileLobbyModules({
      tweakModules: [{
        id: 'imported-runtime',
        kind: 'defs',
        label: 'Imported runtime fixture',
        rawLua: 'UnitDefs.armflash.health = 999',
        enabled: true,
        converted: false,
        stage: 'before-editor',
        order: 0,
      }],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });

    expect(() => executeCompiledBarModules(compiled, {
      unitDefs: { armflash: baseArmflash },
    })).toThrow(/Imported Lua is disabled/);
    const optedIn = executeCompiledBarModules(compiled, {
      unitDefs: { armflash: baseArmflash },
      allowImportedModules: true,
    });
    expect(optedIn.unitDefs.armflash.health).toBe(999);
  });

  it('names the failing lobby field and stops runaway generated Lua', () => {
    const runtimeFailure = compileLobbyModules({
      tweakModules: [],
      generatedTweakDefsLua: 'error("runtime fixture failure")',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });
    expect(() => executeCompiledBarModules(runtimeFailure, {
      unitDefs: { armflash: baseArmflash },
    })).toThrow(/tweakdefs1 failed at runtime.*runtime fixture failure/);

    const runaway = compileLobbyModules({
      tweakModules: [],
      generatedTweakDefsLua: 'while true do end',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });
    expect(() => executeCompiledBarModules(runaway, {
      unitDefs: {},
      instructionLimit: 1000,
    })).toThrow(/Instruction budget exceeded in tweakdefs1/);
  });
});

describe('advanced mechanics BAR runtime fixtures', () => {
  it.each(ADVANCED_MECHANICS_RUNTIME_FIXTURES)(
    '$id — $description',
    fixture => {
      const compiled = compileAdvancedMechanicsFixture(fixture);
      const result = executeCompiledBarModules(compiled, {
        unitDefs: fixture.runtimeUnitDefs,
        weaponDefs: fixture.runtimeWeaponDefs || {},
      });

      assertRuntimeCompatibility(result, fixture.expectations);
      expect(result.status).toBe('passed');
      expect(result.execution.length).toBeGreaterThan(0);
    },
  );
});
