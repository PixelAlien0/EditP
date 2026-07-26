import { describe, expect, it } from 'vitest';
import {
  buildCarrierLinkageTweaks,
  CARRIER_ARCHETYPES,
  getCarrierLinkageConfig,
} from './carrierDroneLinkage.js';
import {
  ensureSafeCarrierWeaponPatch,
  SAFE_ORPHAN_DRONE_AIRTIME_SECONDS,
} from './carrierRuntimeSafety.js';

describe('carrierDroneLinkage', () => {
  it('exposes preset carrier archetypes', () => {
    expect(CARRIER_ARCHETYPES.length).toBeGreaterThanOrEqual(4);
    expect(CARRIER_ARCHETYPES[0].parentUnitId).toBe('armcarrier');
    expect(CARRIER_ARCHETYPES[0].childUnitId).toBe('armantiodrone');
  });

  it('extracts default linkage config correctly', () => {
    const config = getCarrierLinkageConfig('armcarrier');
    expect(config.parentUnitId).toBe('armcarrier');
    expect(config.droneAmmo).toBe(4);
  });

  it('extracts existing tweaks correctly', () => {
    const tweaks = {
      armcarrier: {
        'customparams.carried_unit': 'armodrone',
        'customparams.droneammo': '12',
        'customparams.spawn_metal_cost': '150',
      },
    };
    const config = getCarrierLinkageConfig('armcarrier', tweaks);
    expect(config.carriedUnit).toBe('armodrone');
    expect(config.droneAmmo).toBe(12);
    expect(config.spawnMetal).toBe(150);
  });

  it('reads the real carrier controller WeaponDef from bundled defaults', () => {
    const defaults = {
      armdronecarry: {
        weaponSlots: [
          {
            slot: 1,
            defKey: 'plasma',
            carried_unit: 'armdrone',
            droneammo: 9,
            spawn_metal_cost: 25,
            spawn_energy_cost: 600,
            spawnrate: 4,
            docktohealthreshold: 65,
            spawns_surface: 'SEA',
            carrierdeaththroe: 'release',
            manualdrones: '1',
          },
          { slot: 2, defKey: 'aamissile' },
        ],
      },
    };
    const config = getCarrierLinkageConfig('armdronecarry', {}, defaults);
    expect(config.targetWeaponDef).toBe('plasma');
    expect(config.targetWeaponSlot).toBe(1);
    expect(config.weaponOptions).toHaveLength(2);
    expect(config.carriedUnit).toBe('armdrone');
    expect(config.returnHp).toBe(65);
    expect(config.spawnSurface).toBe('SEA');
    expect(config.manualControl).toBe(true);
    expect(config.isControllable).toBe(false);
  });

  it('builds compiled tweak dictionary safely', () => {
    const result = buildCarrierLinkageTweaks({
      parentUnitId: 'armcarrier',
      carriedUnit: 'ArmODrone ',
      spawnsName: 'armodrone',
      droneAmmo: 8,
      spawnMetal: 200,
      spawnEnergy: 1500,
      spawnInterval: 4,
      returnHp: 30,
      targetWeaponSlot: 2,
      targetWeaponDef: 'plasma',
      spawnSurface: 'SEA',
    });

    expect(result).toEqual({
      editp_carrier_slot: '2',
      editp_carrier_weapondef: 'plasma',
      'weapon_slot_2_carried_unit': 'armodrone',
      'weapon_slot_2_spawns_surface': 'SEA',
      'weapon_slot_2_maxunits': '8',
      'weapon_slot_2_startingdronecount': '0',
      'weapon_slot_2_spawn_metal_cost': '200',
      'weapon_slot_2_spawn_energy_cost': '1500',
      'weapon_slot_2_spawnrate': '4',
      'weapon_slot_2_carrierdeaththroe': 'control',
      'weapon_slot_2_manualdrones': 'true',
      'weapon_slot_2_enabledocking': 'false',
      'weapon_slot_2_droneairtime': String(SAFE_ORPHAN_DRONE_AIRTIME_SECONDS),
      'weapon_slot_2_docktohealthreshold': '30',
      editp_carrier_roster: undefined,
      'customparams.carried_unit': undefined,
      'customparams.spawns_surface': undefined,
      'customparams.droneammo': undefined,
      'customparams.maxunits': undefined,
      'customparams.stockpilelimit': undefined,
      'customparams.startingdronecount': undefined,
      'customparams.spawn_metal_cost': undefined,
      'customparams.spawn_energy_cost': undefined,
      'customparams.metalcost': undefined,
      'customparams.energycost': undefined,
      'customparams.spawn_interval': undefined,
      'customparams.spawnrate': undefined,
      'customparams.carrierdeaththroe': undefined,
      'customparams.manualdrones': undefined,
      'customparams.enabledocking': undefined,
      'customparams.droneairtime': undefined,
      'customparams.docktohealthreshold': undefined,
    });
  });

  it('reads canonical weapon-slot values before legacy workbench values', () => {
    const defaults = {
      carrier: {
        weaponSlots: [
          { slot: 1, defKey: 'carrier_controller', carried_unit: 'default_drone', maxunits: 4 },
          { slot: 2, defKey: 'secondary' },
        ],
      },
    };
    const tweaks = {
      carrier: {
        editp_carrier_slot: '1',
        'customparams.carried_unit': 'legacy_drone',
        'customparams.maxunits': '6',
        'weapon_slot_1_carried_unit': 'workspace_drone',
        'weapon_slot_1_maxunits': '12',
        'weapon_slot_1_docktohealthreshold': '72',
      },
    };

    const config = getCarrierLinkageConfig('carrier', tweaks, defaults);
    expect(config.targetWeaponSlot).toBe(1);
    expect(config.carriedUnit).toBe('workspace_drone');
    expect(config.maxUnits).toBe(12);
    expect(config.returnHp).toBe(72);
  });

  it('loads the requested weapon slot instead of leaking another slot configuration', () => {
    const defaults = {
      carrier: {
        weaponSlots: [
          { slot: 1, defKey: 'carrier_one', carried_unit: 'drone_one', maxunits: 4 },
          { slot: 2, defKey: 'carrier_two', carried_unit: 'drone_two', maxunits: 8 },
        ],
      },
    };
    const tweaks = {
      carrier: {
        'weapon_slot_2_carried_unit': 'edited_drone_two',
        'weapon_slot_2_maxunits': '14',
      },
    };

    const config = getCarrierLinkageConfig('carrier', tweaks, defaults, 2);
    expect(config.targetWeaponSlot).toBe(2);
    expect(config.targetWeaponDef).toBe('carrier_two');
    expect(config.carriedUnit).toBe('edited_drone_two');
    expect(config.maxUnits).toBe(14);
  });

  it('does not treat an explosion spawner as a carrier payload', () => {
    const defaults = {
      launcher: {
        weaponSlots: [
          { slot: 1, defKey: 'spawn_shell', spawns_name: 'spawned_unit', spawns_surface: 'LAND' },
        ],
      },
    };

    const config = getCarrierLinkageConfig('launcher', {}, defaults);
    expect(config.carriedUnit).toBe('');
    expect(config.weaponOptions[0].isCarrierController).toBe(false);
  });

  it('emits BAR manual-control mode and a safe airtime for surviving drones', () => {
    const result = buildCarrierLinkageTweaks({
      parentUnitId: 'legvcarry',
      carriedUnit: 'legdrone',
      maxUnits: 5,
      manualControl: true,
      carrierDeathBehavior: 'control',
      dockingEnabled: false,
    });

    expect(result.weapon_slot_1_manualdrones).toBe('true');
    expect(result.weapon_slot_1_carrierdeaththroe).toBe('control');
    expect(result.weapon_slot_1_droneairtime).toBe(String(SAFE_ORPHAN_DRONE_AIRTIME_SECONDS));
    expect(result.weapon_slot_1_startingdronecount).toBe('0');
  });

  it('does not emit a synthetic airtime when deployed units die with the carrier', () => {
    const result = buildCarrierLinkageTweaks({
      parentUnitId: 'armcarrier',
      carriedUnit: 'armantiodrone',
      manualControl: false,
      carrierDeathBehavior: 'death',
    });

    expect(result.weapon_slot_1_manualdrones).toBe('false');
    expect(result.weapon_slot_1_droneairtime).toBeUndefined();
  });

  it('guards advanced carrier edits that keep drones alive without an airtime', () => {
    const patch = ensureSafeCarrierWeaponPatch(
      { customparams: { carrierdeaththroe: 'control', manualdrones: true } },
      { carried_unit: 'armdrone' }
    );

    expect(patch.customparams.droneairtime).toBe(SAFE_ORPHAN_DRONE_AIRTIME_SECONDS);
  });

  it('preserves explicit carrier airtime values', () => {
    const patch = ensureSafeCarrierWeaponPatch(
      { customparams: { carrierdeaththroe: 'control', droneairtime: 120 } },
      { carried_unit: 'armdrone' }
    );

    expect(patch.customparams.droneairtime).toBe(120);
  });

  it('clears carried_unit in ground mode and builds comma-separated multi-unit roster', () => {
    const result = buildCarrierLinkageTweaks({
      parentUnitId: 'behehive',
      carriedUnit: 'corjugg_custom',
      secondaryUnits: ['armantiodrone', 'corvamp'],
      deployMode: 'ground',
      droneAmmo: 4,
      spawnMetal: 100,
    });

    expect(result.weapon_slot_1_carried_unit).toBe('corjugg_custom armantiodrone corvamp');
    expect(result.weapon_slot_1_spawns_surface).toBe('LAND');
  });
});
