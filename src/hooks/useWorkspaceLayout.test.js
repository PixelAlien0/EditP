import { describe, expect, it } from 'vitest';
import { normalizeWorkspaceLayout, WORKSPACE_LAYOUT_DEFAULTS } from './useWorkspaceLayout.js';

describe('normalizeWorkspaceLayout', () => {
  it('uses stable defaults for unknown or invalid preferences', () => {
    expect(normalizeWorkspaceLayout({ density: 'tiny', inspectorTab: 'unknown' })).toMatchObject({
      density: WORKSPACE_LAYOUT_DEFAULTS.density,
      inspectorTab: WORKSPACE_LAYOUT_DEFAULTS.inspectorTab,
    });
  });

  it('clamps pane widths without discarding other preferences', () => {
    expect(normalizeWorkspaceLayout({ leftWidth: 10, rightWidth: 900, rightCollapsed: true })).toMatchObject({
      leftWidth: 216,
      rightWidth: 520,
      rightCollapsed: true,
    });
  });
});
