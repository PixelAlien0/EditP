import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppHeader from './AppHeader.jsx';

afterEach(cleanup);

function renderHeader(overrides = {}) {
  const callbacks = {
    onWorkspaceChange: vi.fn(),
    onMainMenu: vi.fn(),
    onToggleTheme: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onCredits: vi.fn(),
    onChat: vi.fn(),
    onClone: vi.fn(),
    onCommandPalette: vi.fn(),
    onCheckpoints: vi.fn(),
    onCollections: vi.fn(),
    onCarrierWorkbench: vi.fn(),
    onPresetGallery: vi.fn(),
    onWeaponLab: vi.fn(),
    onTweakLab: vi.fn(),
    onWeaponDefLibrary: vi.fn(),
    onReferenceLibrary: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
  };
  render(
    <AppHeader
      activeWorkspace="edit"
      themeMode="dark"
      historyPastCount={0}
      historyFutureCount={0}
      presence={{ count: 1, status: 'connected', activityCounts: {}, currentActivity: 'edit-units' }}
      unreadChatCount={0}
      {...callbacks}
      {...overrides}
    />,
  );
  return callbacks;
}

describe('AppHeader', () => {
  it('routes workspace navigation through its explicit interface', async () => {
    const user = userEvent.setup();
    const callbacks = renderHeader();

    await user.click(screen.getByRole('button', { name: /build menus/i }));

    expect(callbacks.onWorkspaceChange).toHaveBeenCalledWith('designer');
  });

  it('surfaces project validation status in Review & Export', () => {
    renderHeader({ validationIssueCount: 3 });

    expect(screen.getByLabelText('3 validation issues')).toHaveTextContent('3');
  });

  it('keeps the command palette directly accessible', async () => {
    const user = userEvent.setup();
    const callbacks = renderHeader();

    await user.click(screen.getByRole('button', { name: 'Open command palette' }));

    expect(callbacks.onCommandPalette).toHaveBeenCalledOnce();
  });

  it('owns the Tools menu lifecycle and closes it after selection', async () => {
    const user = userEvent.setup();
    const callbacks = renderHeader();

    await user.click(screen.getByRole('button', { name: 'Tools' }));
    expect(screen.getByRole('menu', { name: 'Editor tools' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /project checkpoints/i }));
    expect(callbacks.onCheckpoints).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu', { name: 'Editor tools' })).not.toBeInTheDocument();
  });

  it('closes the Tools menu with Escape and restores trigger focus', async () => {
    const user = userEvent.setup();
    renderHeader();
    const trigger = screen.getByRole('button', { name: 'Tools' });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu', { name: 'Editor tools' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('states tool readiness and runtime provenance in the menu', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Tools' }));

    expect(screen.getByRole('menuitem', { name: /batch adjust/i })).toHaveTextContent('Locked');
    expect(screen.getByRole('menuitem', { name: /carrier & drone studio/i })).toHaveTextContent('Gadget');
    expect(screen.getByRole('menuitem', { name: /carrier & drone studio/i })).toHaveTextContent('Experimental');
    expect(screen.getByRole('menuitem', { name: /weapondef library/i })).toHaveTextContent('Generated');
    expect(screen.getByRole('menuitem', { name: /weapondef library/i })).toHaveTextContent('Preflight');
    expect(screen.getByRole('menuitem', { name: /bar reference library/i })).toHaveTextContent('Reference');
  });
});
