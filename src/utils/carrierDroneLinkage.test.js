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
    });

    expect(result).toEqual({
      'customparams.carried_unit': 'armodrone',
      'customparams.spawns_name': 'armodrone',
      'customparams.droneammo': '8',
      'customparams.spawn_metal_cost': '200',
      'customparams.spawn_energy_cost': '1500',
      'customparams.spawn_interval': '4',
      'customparams.drone_return_hp': '30',
    });
  });
});
