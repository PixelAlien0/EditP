import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WeaponLaboratoryPage from './WeaponLaboratoryPage.jsx';
import { createWeaponBlueprintDraft } from '../utils/weaponBlueprint.js';

afterEach(cleanup);

function renderLaboratory(overrides = {}) {
  const draft = createWeaponBlueprintDraft({
    sourceUnitId: 'armflash',
    slot: {
      defKey: 'plasma',
      damage: 100,
      reload: 2,
      range: 500,
      projectiles: 1,
      burst: 1,
    },
  });
  const props = {
    draft,
    library: [],
    sourceCatalog: [{
      id: 'armflash:plasma',
      sourceUnitId: 'armflash',
      sourceUnitName: 'Flash',
      sourceWeaponDefKey: 'plasma',
      slot: {
        defKey: 'plasma',
        damage: 100,
        reload: 2,
        range: 500,
        projectiles: 1,
        burst: 1,
      },
    }],
    onDraftChange: vi.fn(),
    onCloneSource: vi.fn(),
    onSave: vi.fn(() => ({ ...draft, id: 'saved' })),
    onDelete: vi.fn(),
    onExportVfx: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<WeaponLaboratoryPage {...props} />), props };
}

describe('WeaponLaboratoryPage', () => {
  it('starts with source selection and separates authoring, effects, and storage workflows', async () => {
    const user = userEvent.setup();
    const { props } = renderLaboratory();
    expect(screen.getAllByText('50.0').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Choose a weapon to clone' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clone fresh copy' }));
    expect(props.onCloneSource).toHaveBeenCalledWith(expect.objectContaining({
      sourceUnitId: 'armflash',
      sourceWeaponDefKey: 'plasma',
    }));
    expect(screen.getByRole('heading', { name: 'Define the reusable profile' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Effects & assets' }));
    expect(screen.getByText('Native weapon references')).toBeInTheDocument();
    expect(screen.getByText(/does not simulate Recoil rendering/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Custom storage/ }));
    expect(screen.getByText('Custom weapon storage is empty')).toBeInTheDocument();
  });

  it('saves to storage without exposing an immediate equip action', async () => {
    const user = userEvent.setup();
    const { props } = renderLaboratory();
    await user.click(screen.getByRole('button', { name: 'Clone fresh copy' }));
    const saveButton = screen.getByRole('button', { name: 'Save to custom storage' });
    expect(saveButton).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Save & equip/ })).not.toBeInTheDocument();
    await user.click(saveButton);
    expect(props.onSave).toHaveBeenCalled();
  });
});
