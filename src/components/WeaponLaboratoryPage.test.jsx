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
    selectedUnit: { id: 'armflash_clone', isClone: true },
    activeSlotNumber: 1,
    onDraftChange: vi.fn(),
    onNewVariant: vi.fn(),
    onSave: vi.fn(() => ({ ...draft, id: 'saved' })),
    onEquip: vi.fn(),
    onDelete: vi.fn(),
    onExportVfx: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<WeaponLaboratoryPage {...props} />), props };
}

describe('WeaponLaboratoryPage', () => {
  it('shows output analysis and separates gameplay, effects, and library workflows', async () => {
    const user = userEvent.setup();
    renderLaboratory();
    expect(screen.getByText('50.0')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Define the reusable profile' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Effects & assets' }));
    expect(screen.getByText('Native weapon references')).toBeInTheDocument();
    expect(screen.getByText(/does not simulate Recoil rendering/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Blueprint library/ }));
    expect(screen.getByText('No saved blueprints')).toBeInTheDocument();
  });

  it('does not allow a vanilla unit to equip a blueprint', () => {
    renderLaboratory({ selectedUnit: { id: 'armflash', isClone: false } });
    expect(screen.getByRole('button', { name: /Save & equip/ })).toBeDisabled();
    expect(screen.getByText(/Select or create a cloned unit/i)).toBeInTheDocument();
  });
});
