import { describe, expect, it } from 'vitest';
import { compileLobbyModules } from './lobbyModules.js';
import { buildExportTraceReport } from './exportTrace.js';

describe('export trace report', () => {
  it('links unit patches and generated definitions to their final lobby fields', () => {
    const compiled = compileLobbyModules({
      tweakModules: [],
      generatedTweakDefsLua: '-- EDITP_BUILDMENU_BEGIN\nlocal menu = true\n-- EDITP_BUILDMENU_END',
      generatedTweakUnitsLua: '{ armflash = { health = 1200, }, }',
    });
    const report = buildExportTraceReport(compiled);

    expect(report.summary).toMatchObject({ canonicalBlocks: 2, deliveredBlocks: 2, slots: 2 });
    expect(report.traces).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: 'defs', sourceFeature: 'build-menus', slotFieldName: 'tweakdefs' }),
      expect.objectContaining({ lane: 'units', sourceIdentity: 'armflash', slotFieldName: 'tweakunits' }),
    ]));
  });

  it('retains the final slot for canonical blocks removed by safe deduplication', () => {
    const feature = '-- EDITP_BUILDMENU_BEGIN\nlocal exact_menu = true\n-- EDITP_BUILDMENU_END';
    const compiled = compileLobbyModules({
      tweakModules: [],
      generatedTweakDefsLua: `${feature}\n\n${feature}`,
      generatedTweakUnitsLua: '',
    });
    const report = buildExportTraceReport(compiled);

    expect(report.summary.deduplicatedBlocks).toBe(1);
    expect(report.traces).toHaveLength(2);
    expect(report.traces.every(trace => trace.slotFieldName === 'tweakdefs')).toBe(true);
  });
});
