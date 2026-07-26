import { describe, expect, it } from 'vitest';
import {
  buildCarrierLinkageTweaks,
  CARRIER_ARCHETYPES,
  getCarrierLinkageConfig,
} from './carrierDroneLinkage.js';

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
          },
          { slot: 2, defKey: 'aamissile' },
        ],
      },
    };
    const config = getCarrierLinkageConfig('armdronecarry', {}, defaults);
    expect(config.targetWeaponDef).toBe('plasma');
    expect(config.weaponOptions).toHaveLength(2);
    expect(config.carriedUnit).toBe('armdrone');
    expect(config.returnHp).toBe(65);
    expect(config.spawnSurface).toBe('SEA');
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
      targetWeaponDef: 'plasma',
      spawnSurface: 'SEA',
    });

    expect(result).toEqual({
      editp_carrier_weapondef: 'plasma',
      editp_carrier_roster: 'armodrone',
      'customparams.carried_unit': 'armodrone',
      'customparams.spawns_surface': 'SEA',
      'customparams.droneammo': '8',
      'customparams.maxunits': '8',
      'customparams.stockpilelimit': '8',
      'customparams.startingdronecount': '8',
      'customparams.metalcost': '200',
      'customparams.energycost': '1500',
      'customparams.spawnrate': '4',
      'customparams.carrierdeaththroe': 'release',
      'customparams.enabledocking': true,
      'customparams.docktohealthreshold': 30,
    });
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

    expect(result['customparams.carried_unit']).toBe('corjugg_custom');
    expect(result.editp_carrier_roster).toBe('corjugg_custom armantiodrone corvamp');
    expect(result['customparams.spawns_surface']).toBe('LAND');
  });
});
