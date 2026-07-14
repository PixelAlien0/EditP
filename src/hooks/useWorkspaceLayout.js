import { useCallback, useEffect, useState } from 'react';

export const WORKSPACE_LAYOUT_STORAGE_KEY = 'editp_workspace_layout_v1';

export const WORKSPACE_LAYOUT_LIMITS = Object.freeze({
  left: { min: 248, max: 380, default: 304 },
  right: { min: 320, max: 520, default: 380 },
});

export const WORKSPACE_LAYOUT_DEFAULTS = Object.freeze({
  leftWidth: WORKSPACE_LAYOUT_LIMITS.left.default,
  rightWidth: WORKSPACE_LAYOUT_LIMITS.right.default,
  leftCollapsed: false,
  rightCollapsed: false,
  density: 'balanced',
  inspectorTab: 'details',
  collapsedGroups: {},
});

const VALID_DENSITIES = new Set(['compact', 'balanced', 'comfortable']);
const VALID_INSPECTOR_TABS = new Set(['details', 'compare', 'changes', 'identity']);

function clamp(value, min, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : min;
}

export function normalizeWorkspaceLayout(value = {}) {
  return {
    ...WORKSPACE_LAYOUT_DEFAULTS,
    ...value,
    leftWidth: clamp(value.leftWidth ?? WORKSPACE_LAYOUT_DEFAULTS.leftWidth, WORKSPACE_LAYOUT_LIMITS.left.min, WORKSPACE_LAYOUT_LIMITS.left.max),
    rightWidth: clamp(value.rightWidth ?? WORKSPACE_LAYOUT_DEFAULTS.rightWidth, WORKSPACE_LAYOUT_LIMITS.right.min, WORKSPACE_LAYOUT_LIMITS.right.max),
    leftCollapsed: Boolean(value.leftCollapsed),
    rightCollapsed: Boolean(value.rightCollapsed),
    density: VALID_DENSITIES.has(value.density) ? value.density : WORKSPACE_LAYOUT_DEFAULTS.density,
    inspectorTab: VALID_INSPECTOR_TABS.has(value.inspectorTab) ? value.inspectorTab : WORKSPACE_LAYOUT_DEFAULTS.inspectorTab,
    collapsedGroups: value.collapsedGroups && typeof value.collapsedGroups === 'object'
      ? value.collapsedGroups
      : {},
  };
}

function loadWorkspaceLayout() {
  if (typeof localStorage === 'undefined') return WORKSPACE_LAYOUT_DEFAULTS;
  try {
    return normalizeWorkspaceLayout(JSON.parse(localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) || '{}'));
  } catch {
    return WORKSPACE_LAYOUT_DEFAULTS;
  }
}

export function useWorkspaceLayout() {
  const [preferences, setPreferences] = useState(loadWorkspaceLayout);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 1920 : window.innerWidth);
  const [overlayPane, setOverlayPane] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // The workbench remains usable when browser storage is unavailable.
    }
  }, [preferences]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setOverlayPane(null);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updateLayout = useCallback(patch => {
    setPreferences(current => normalizeWorkspaceLayout({
      ...current,
      ...(typeof patch === 'function' ? patch(current) : patch),
    }));
  }, []);

  const setLeftWidth = useCallback(leftWidth => updateLayout({ leftWidth }), [updateLayout]);
  const setRightWidth = useCallback(rightWidth => updateLayout({ rightWidth }), [updateLayout]);
  const setLeftCollapsed = useCallback(leftCollapsed => {
    if (viewportWidth < 1180) {
      setOverlayPane(leftCollapsed ? null : 'left');
      return;
    }
    updateLayout({ leftCollapsed });
  }, [updateLayout, viewportWidth]);
  const setRightCollapsed = useCallback(rightCollapsed => {
    if (viewportWidth < 1440) {
      setOverlayPane(rightCollapsed ? null : 'right');
      return;
    }
    updateLayout({ rightCollapsed });
  }, [updateLayout, viewportWidth]);
  const setDensity = useCallback(density => updateLayout({ density }), [updateLayout]);
  const setInspectorTab = useCallback(inspectorTab => updateLayout({ inspectorTab }), [updateLayout]);
  const closeOverlayPanes = useCallback(() => setOverlayPane(null), []);
  const toggleGroup = useCallback(groupId => updateLayout(current => ({
    collapsedGroups: {
      ...current.collapsedGroups,
      [groupId]: !current.collapsedGroups[groupId],
    },
  })), [updateLayout]);

  const layout = {
    ...preferences,
    leftCollapsed: viewportWidth < 1180 ? overlayPane !== 'left' : preferences.leftCollapsed,
    rightCollapsed: viewportWidth < 1440 ? overlayPane !== 'right' : preferences.rightCollapsed,
  };

  return {
    layout,
    setLeftWidth,
    setRightWidth,
    setLeftCollapsed,
    setRightCollapsed,
    setDensity,
    setInspectorTab,
    closeOverlayPanes,
    toggleGroup,
  };
}
