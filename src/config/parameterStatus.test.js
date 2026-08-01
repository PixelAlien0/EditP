import { describe, expect, it } from 'vitest';
import { resolveParameterStatuses } from './parameterStatus.js';

describe('resolveParameterStatuses', () => {
  it('distinguishes BAR values from inherited engine values', () => {
    expect(resolveParameterStatuses({ source: 'bar' }).map(status => status.label)).toEqual(['BAR']);
    expect(resolveParameterStatuses().map(status => status.label)).toEqual(['Inherited']);
  });

  it('keeps runtime provenance visible beside an edited value', () => {
    expect(resolveParameterStatuses({
      modified: true,
      capabilityIds: ['bar-gadget'],
      generated: true,
    }).map(status => status.label)).toEqual(['Edited', 'Generated', 'Gadget']);
  });

  it('marks unverified package data as external', () => {
    expect(resolveParameterStatuses({ modified: true, external: true }).map(status => status.label))
      .toEqual(['Edited', 'External mod']);
  });
});

