import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildPreset, buildPresetSnapshot, usePresetController } from './usePresetController.js';

const PROJECT_STATE = {
  tweaks: { armck: { health: 1200 } },
  clones: [{ newId: 'test_clone' }],
  disabledUnitIds: ['corllt'],
  unitDescriptions: { armck: 'Edited engineer' },
  buildMenuSteps: [{ builderId: 'armlab' }],
  buildMenuPacks: { extraUnits: true, scavengerUnits: false },
  weaponLibrary: [{ id: 'weapon_a' }],
  supportingWeaponDefs: [{ name: 'support_def' }],
  unitCollections: [{ id: 'collection_a' }],
  tweakModules: [{ id: 'module_a' }],
  lobbySetup: { startingEnergy: 500 },
  projectName: 'Test Project',
  projectAuthor: 'tester',
  projectDesc: 'A test project',
  includeTweaks: true,
  includeClones: true,
  includeRosters: false,
  includeHeader: true,
  // Fields outside the snapshot contract must be ignored.
  exportEnglishOnly: false,
  compactLuaFormatting: true,
  presets: [{ id: 'existing' }],
};

describe('buildPresetSnapshot', () => {
  it('captures exactly the persisted snapshot field list, in order', () => {
    expect(Object.keys(buildPresetSnapshot(PROJECT_STATE))).toEqual([
      'tweaks',
      'clones',
      'disabledUnitIds',
      'unitDescriptions',
      'buildMenuSteps',
      'buildMenuPacks',
      'weaponLibrary',
      'supportingWeaponDefs',
      'unitCollections',
      'tweakModules',
      'lobbySetup',
      'projectName',
      'projectAuthor',
      'projectDesc',
      'includeTweaks',
      'includeClones',
      'includeRosters',
      'includeHeader',
    ]);
  });

  it('copies every snapshot value from the project state by reference', () => {
    const snapshot = buildPresetSnapshot(PROJECT_STATE);
    expect(snapshot).toEqual({
      tweaks: PROJECT_STATE.tweaks,
      clones: PROJECT_STATE.clones,
      disabledUnitIds: PROJECT_STATE.disabledUnitIds,
      unitDescriptions: PROJECT_STATE.unitDescriptions,
      buildMenuSteps: PROJECT_STATE.buildMenuSteps,
      buildMenuPacks: PROJECT_STATE.buildMenuPacks,
      weaponLibrary: PROJECT_STATE.weaponLibrary,
      supportingWeaponDefs: PROJECT_STATE.supportingWeaponDefs,
      unitCollections: PROJECT_STATE.unitCollections,
      tweakModules: PROJECT_STATE.tweakModules,
      lobbySetup: PROJECT_STATE.lobbySetup,
      projectName: 'Test Project',
      projectAuthor: 'tester',
      projectDesc: 'A test project',
      includeTweaks: true,
      includeClones: true,
      includeRosters: false,
      includeHeader: true,
    });
    expect(snapshot.tweaks).toBe(PROJECT_STATE.tweaks);
    expect(snapshot.lobbySetup).toBe(PROJECT_STATE.lobbySetup);
  });

  it('leaves non-snapshot project fields out of the snapshot', () => {
    const snapshot = buildPresetSnapshot(PROJECT_STATE);
    expect(snapshot).not.toHaveProperty('exportEnglishOnly');
    expect(snapshot).not.toHaveProperty('compactLuaFormatting');
    expect(snapshot).not.toHaveProperty('presets');
  });
});

describe('buildPreset', () => {
  it('assembles id, name, description, createdAt, and snapshot', () => {
    const snapshot = buildPresetSnapshot(PROJECT_STATE);
    const preset = buildPreset('My preset', 'Notes', snapshot);

    expect(preset.id).toMatch(/^\d+-[a-z0-9]{1,5}$/);
    expect(preset.name).toBe('My preset');
    expect(preset.description).toBe('Notes');
    expect(Number.isNaN(Date.parse(preset.createdAt))).toBe(false);
    expect(new Date(preset.createdAt).toISOString()).toBe(preset.createdAt);
    expect(preset.snapshot).toBe(snapshot);
    expect(Object.keys(preset)).toEqual(['id', 'name', 'description', 'createdAt', 'snapshot']);
  });

  it('keeps an empty name and description as given (fallback naming is the caller\'s job)', () => {
    const preset = buildPreset('', '', {});
    expect(preset.name).toBe('');
    expect(preset.description).toBe('');
    expect(preset.snapshot).toEqual({});
  });

  it('generates distinct ids for consecutive presets', () => {
    const first = buildPreset('a', '', {});
    const second = buildPreset('b', '', {});
    expect(first.id).not.toBe(second.id);
  });
});

describe('usePresetController', () => {
  it('saves, applies, and deletes presets through the project-store interfaces', () => {
    const applyProjectSnapshot = vi.fn();
    const onApplied = vi.fn();
    const showToast = vi.fn();
    const useHarness = () => {
      const [presets, setPresets] = useState([]);
      const controller = usePresetController({
        projectStore: PROJECT_STATE,
        setPresets,
        applyProjectSnapshot,
        showToast,
        onApplied,
      });
      return { presets, ...controller };
    };
    const view = renderHook(() => useHarness());

    act(() => {
      view.result.current.setPresetName('Balance pass');
      view.result.current.setPresetDescription('Fast economy');
    });
    act(() => view.result.current.handleSavePreset());

    expect(view.result.current.presets).toHaveLength(1);
    expect(view.result.current.presets[0]).toMatchObject({
      name: 'Balance pass',
      description: 'Fast economy',
    });
    expect(view.result.current.presetName).toBe('');
    expect(view.result.current.presetDescription).toBe('');

    const saved = view.result.current.presets[0];
    act(() => view.result.current.handleApplyPreset(saved));
    expect(applyProjectSnapshot).toHaveBeenCalledWith(saved.snapshot);
    expect(onApplied).toHaveBeenCalledOnce();

    act(() => view.result.current.handleDeletePreset(saved.id));
    expect(view.result.current.presets).toEqual([]);
  });
});
