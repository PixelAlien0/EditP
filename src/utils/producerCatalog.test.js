import { describe, expect, it } from 'vitest';
import { createProducerCatalog, PRODUCER_KIND } from './producerCatalog.js';

describe('producer catalog', () => {
  it('separates static factories from mobile builders', () => {
    const catalog = createProducerCatalog(
      { armlab: ['armck'], armck: ['armlab'] },
      { armlab: 'Bot Lab', armck: 'Construction Bot' },
      {
        armlab: { 'customparams.techlevel': 1 },
        armck: { maxvelocity: 36, 'customparams.techlevel': 1 },
      }
    );

    expect(catalog).toEqual([
      expect.objectContaining({ id: 'armlab', kind: PRODUCER_KIND.FACTORY, kindLabel: 'Factory' }),
      expect.objectContaining({ id: 'armck', kind: PRODUCER_KIND.BUILDER, kindLabel: 'Builder' }),
    ]);
  });

  it('omits unnamed BAR helper definitions instead of exposing raw IDs', () => {
    const catalog = createProducerCatalog(
      { armlab: [], armsalab: [], armcomcon: [] },
      { armlab: 'Bot Lab' },
      {}
    );

    expect(catalog.map(entry => entry.id)).toEqual(['armlab']);
  });

  it('keeps decimal tech levels and roster size as useful catalog metadata', () => {
    const [producer] = createProducerCatalog(
      { armplat: ['armseap', 'armsfig'] },
      { armplat: 'Seaplane Platform' },
      { armplat: { 'customparams.techlevel': 1.5 } }
    );

    expect(producer).toMatchObject({ tier: 'T1.5', rosterSize: 2 });
  });
});
