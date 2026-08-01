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
