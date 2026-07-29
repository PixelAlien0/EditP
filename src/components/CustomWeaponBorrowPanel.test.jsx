import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CustomWeaponBorrowPanel from './CustomWeaponBorrowPanel.jsx';

afterEach(cleanup);

const storedWeapon = {
  id: 'weapon_rose',
  name: 'Rose Cannon',
  description: 'High-alpha custom cannon.',
  sourceUnitId: 'armflash',
  sourceWeaponDefKey: 'plasma',
  appearance: { color: '#d69aaa' },
  overrides: {
    damage: 240,
    reload: 2,
    range: 620,
    aoe: 48,
    burst: 1,
    projectiles: 1,
  },
};

describe('CustomWeaponBorrowPanel', () => {
  it('equips the selected stored weapon on the requested slot', async () => {
    const user = userEvent.setup();
    const onEquip = vi.fn();
    render(
      <CustomWeaponBorrowPanel
        library={[storedWeapon]}
        selectedBlueprintId="weapon_rose"
        targetSlot={2}
        onSelect={vi.fn()}
        onEquip={onEquip}
        onOpenLaboratory={vi.fn()}
      />
    );
    expect(screen.getAllByText('Rose Cannon').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Equip custom weapon on slot 2' }));
    expect(onEquip).toHaveBeenCalledWith(storedWeapon);
  });

  it('directs an empty storage to the Weapon Laboratory', async () => {
    const user = userEvent.setup();
    const onOpenLaboratory = vi.fn();
    render(
      <CustomWeaponBorrowPanel
        library={[]}
        selectedBlueprintId={null}
        targetSlot={1}
        onSelect={vi.fn()}
        onEquip={vi.fn()}
        onOpenLaboratory={onOpenLaboratory}
      />
    );
    expect(screen.getByText('Storage is empty')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Open Weapon Laboratory' })[0]);
    expect(onOpenLaboratory).toHaveBeenCalled();
  });
});
