import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EDITOR_THEME_STORAGE_KEY,
  UNIT_PARAMETER_VIEW_STORAGE_KEY,
  WEAPON_PARAMETER_VIEW_STORAGE_KEY,
  useEditorPreferences,
} from './useEditorPreferences.js';

describe('useEditorPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to defaults when localStorage is empty', () => {
    const { result } = renderHook(() => useEditorPreferences());

    expect(result.current.themeMode).toBe('dark');
    expect(result.current.showAllUnitParams).toBe(false);
    expect(result.current.showAllWeaponParams).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('reads saved preferences from localStorage', () => {
    localStorage.setItem(EDITOR_THEME_STORAGE_KEY, 'light');
    localStorage.setItem(UNIT_PARAMETER_VIEW_STORAGE_KEY, 'all');
    localStorage.setItem(WEAPON_PARAMETER_VIEW_STORAGE_KEY, 'all');

    const { result } = renderHook(() => useEditorPreferences());

    expect(result.current.themeMode).toBe('light');
    expect(result.current.showAllUnitParams).toBe(true);
    expect(result.current.showAllWeaponParams).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('ignores invalid saved theme values', () => {
    localStorage.setItem(EDITOR_THEME_STORAGE_KEY, 'neon');

    const { result } = renderHook(() => useEditorPreferences());

    expect(result.current.themeMode).toBe('dark');
  });

  it('updates state and persists when setters are called', () => {
    const { result } = renderHook(() => useEditorPreferences());

    act(() => {
      result.current.setThemeMode('light');
      result.current.setShowAllUnitParams(true);
      result.current.setShowAllWeaponParams(true);
    });

    expect(result.current.themeMode).toBe('light');
    expect(result.current.showAllUnitParams).toBe(true);
    expect(result.current.showAllWeaponParams).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(EDITOR_THEME_STORAGE_KEY)).toBe('light');
    expect(localStorage.getItem(UNIT_PARAMETER_VIEW_STORAGE_KEY)).toBe('all');
    expect(localStorage.getItem(WEAPON_PARAMETER_VIEW_STORAGE_KEY)).toBe('all');

    act(() => {
      result.current.setShowAllUnitParams(false);
      result.current.setShowAllWeaponParams(false);
    });

    expect(localStorage.getItem(UNIT_PARAMETER_VIEW_STORAGE_KEY)).toBe('relevant');
    expect(localStorage.getItem(WEAPON_PARAMETER_VIEW_STORAGE_KEY)).toBe('relevant');
  });

  it('keeps defaults when localStorage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { result } = renderHook(() => useEditorPreferences());

    expect(result.current.themeMode).toBe('dark');
    expect(result.current.showAllUnitParams).toBe(false);
    expect(result.current.showAllWeaponParams).toBe(false);
  });
});
