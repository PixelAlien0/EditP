import { describe, expect, it } from 'vitest';
import { buildByteBudgetReport } from './byteBudget.js';
import { compileLobbyModules } from './lobbyModules.js';

function importedModule(id, rawLua, kind = 'defs') {
  return {
    id,
    kind,
    label: `Module ${id}`,
    rawLua,
    enabled: true,
    converted: false,
    stage: 'before-editor',
    order: Number(id.replace(/\D/g, '')) || 0,
  };
}

describe('byte budget inspector analysis', () => {
  it('reports exact lane totals and populated-slot headroom', () => {
    const compiled = compileLobbyModules({
      tweakModules: [importedModule('1', 'local imported_value = true')],
      generatedTweakDefsLua: 'local generated_value = true',
      generatedTweakUnitsLua: '{ armflash = { health = 100 } }',
      base64Options: { padding: false },
    });
    const report = buildByteBudgetReport(compiled);

    expect(report.aggregate.encodedBytes).toBe(
      compiled.defs.totalEncodedBytes + compiled.units.totalEncodedBytes,
    );
    expect(report.aggregate.slotsRequired).toBe(compiled.defs.required + compiled.units.required);
    expect(report.lanes.map(lane => lane.required)).toEqual([
      compiled.defs.required,
      compiled.units.required,
    ]);
    expect(report.slots.every(slot => (
      slot.limitHeadroom === 16384 - slot.encodedBytes
    ))).toBe(true);
    expect(report.contributors.every(contributor => contributor.estimatedEncodedBytes > 0)).toBe(true);
  });

  it('blocks oversized atomic imports at the multiplayer field limit', () => {
    const compiled = compileLobbyModules({
      tweakModules: [importedModule('large', `local payload = "${'x'.repeat(13000)}"`)],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });
    const report = buildByteBudgetReport(compiled);

    expect(compiled.overflow).toBe(true);
    expect(compiled.defs.sizeOverflow).toBe(true);
    expect(report.status).toBe('blocked');
    expect(report.slots[0].status).toBe('blocked');
    expect(report.suggestions.some(suggestion => suggestion.title.includes('multiplayer limit'))).toBe(true);
    expect(report.suggestions.some(suggestion => suggestion.title.includes('Module large'))).toBe(true);
  });

  it('turns lane overflow into a blocking reduction action', () => {
    const compiled = compileLobbyModules({
      tweakModules: Array.from({ length: 31 }, (_, index) => (
        importedModule(String(index + 1), `local value_${index + 1} = true`)
      )),
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });
    const report = buildByteBudgetReport(compiled);

    expect(report.status).toBe('blocked');
    expect(report.lanes[0]).toMatchObject({
      required: 31,
      maximum: 30,
      overflowBy: 1,
      overflow: true,
    });
    expect(report.aggregate.slotsRequired).toBe(31);
    expect(report.suggestions[0]).toMatchObject({
      level: 'error',
      title: 'Definitions needs 1 fewer slot',
    });
  });

  it('surfaces safe deduplication savings and keeps contributor provenance', () => {
    const lua = 'local exact_duplicate = true';
    const compiled = compileLobbyModules({
      tweakModules: [
        importedModule('1', lua),
        importedModule('2', lua),
      ],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });
    const report = buildByteBudgetReport(compiled);

    expect(report.deduplication.removedBlockCount).toBe(1);
    expect(report.contributors).toHaveLength(1);
    expect(report.contributors[0]).toMatchObject({
      slotFieldName: 'tweakdefs',
      duplicateCount: 1,
    });
    expect(report.suggestions.some(suggestion => suggestion.title.includes('Safe deduplication'))).toBe(true);
  });

  it('sorts equally sized contributors deterministically', () => {
    const project = {
      tweakModules: [
        importedModule('2', 'local value_b = true'),
        importedModule('1', 'local value_a = true'),
      ],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    };
    const first = buildByteBudgetReport(compileLobbyModules(project));
    const second = buildByteBudgetReport(compileLobbyModules({
      ...project,
      tweakModules: [...project.tweakModules].reverse(),
    }));

    expect(first.contributors.map(item => item.id)).toEqual(second.contributors.map(item => item.id));
  });
});
