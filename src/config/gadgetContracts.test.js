import { describe, expect, it } from 'vitest';
import gameDataManifest from '../data/game-data-manifest.json';
import {
  GADGET_CONTRACT_REGISTRY,
  GADGET_CONTRACT_REGISTRY_VERSION,
} from './gadgetContracts.js';

describe('BAR gadget contract registry', () => {
  it('is versioned and pinned to the bundled BAR snapshot', () => {
    expect(GADGET_CONTRACT_REGISTRY_VERSION).toBe(2);
    expect(GADGET_CONTRACT_REGISTRY.length).toBeGreaterThanOrEqual(8);
    GADGET_CONTRACT_REGISTRY.forEach(contract => {
      expect(contract.source.commit).toBe(gameDataManifest.sourceCommit);
      expect(contract.source.repository).toBe('beyond-all-reason/Beyond-All-Reason');
      expect(contract.source.path).toMatch(/\.lua$/);
    });
  });

  it('keeps contract identifiers unique while allowing one consumer to own multiple contracts', () => {
    expect(new Set(GADGET_CONTRACT_REGISTRY.map(contract => contract.id)).size)
      .toBe(GADGET_CONTRACT_REGISTRY.length);
    expect(GADGET_CONTRACT_REGISTRY.filter(
      contract => contract.source.path === 'luarules/gadgets/unit_custom_weapons_behaviours.lua'
    ).map(contract => contract.id)).toEqual([
      'sector-fire',
      'special-projectile-behavior',
    ]);
  });
});
