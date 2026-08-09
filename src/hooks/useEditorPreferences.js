import { useEffect, useState } from 'react';

export const EDITOR_THEME_STORAGE_KEY = 'bmf_theme';
export const UNIT_PARAMETER_VIEW_STORAGE_KEY = 'editp_unit_parameter_view_v1';
export const WEAPON_PARAMETER_VIEW_STORAGE_KEY = 'editp_weapon_parameter_view_v2';

export function useEditorPreferences() {
  const [themeMode, setThemeMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem(EDITOR_THEME_STORAGE_KEY);
      return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [showAllUnitParams, setShowAllUnitParams] = useState(() => {
    try {
      return localStorage.getItem(UNIT_PARAMETER_VIEW_STORAGE_KEY) === 'all';
    } catch {
      return false;
    }
  });
  const [showAllWeaponParams, setShowAllWeaponParams] = useState(() => {
    try {
      const savedPreference = localStorage.getItem(WEAPON_PARAMETER_VIEW_STORAGE_KEY);
      return savedPreference === 'all';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    try {
      localStorage.setItem(EDITOR_THEME_STORAGE_KEY, themeMode);
    } catch {
      // Preferences are optional when storage is unavailable.
    }
  }, [themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem(UNIT_PARAMETER_VIEW_STORAGE_KEY, showAllUnitParams ? 'all' : 'relevant');
    } catch {
      // The preference remains available for this session when storage is blocked.
    }
  }, [showAllUnitParams]);

  useEffect(() => {
    try {
      localStorage.setItem(WEAPON_PARAMETER_VIEW_STORAGE_KEY, showAllWeaponParams ? 'all' : 'relevant');
    } catch {
      // The preference remains available for this session when storage is blocked.
    }
  }, [showAllWeaponParams]);

  return {
    themeMode,
    setThemeMode,
    showAllUnitParams,
    setShowAllUnitParams,
    showAllWeaponParams,
    setShowAllWeaponParams,
  };
}
