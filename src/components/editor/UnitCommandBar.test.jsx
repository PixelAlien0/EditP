import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UnitCommandBar from './UnitCommandBar.jsx';

function renderCommandBar(overrides = {}) {
  const props = {
    baseId: 'armflash',
    artworkUrl: '/logo.svg',
    unitId: 'armflash',
    name: 'Flash',
    faction: 'arm',
    tier: 't1',
    unitClass: 'Vehicle',
    weaponCount: 1,
    overrideCount: 0,
    isClone: false,
    descriptionEdited: false,
    disabled: false,
    onDisabledChange: vi.fn(),
    onReset: vi.fn(),
    onOpenIdentity: vi.fn(),
    onOpenDescription: vi.fn(),
    ...overrides,
  };
  render(<UnitCommandBar {...props} />);
  return props;
}

describe('UnitCommandBar', () => {
  it('opens description editing for vanilla units', () => {
    const props = renderCommandBar();

    fireEvent.click(screen.getByRole('button', { name: 'Edit description' }));

    expect(props.onOpenDescription).toHaveBeenCalledOnce();
  });

  it('makes an existing description override visible', () => {
    renderCommandBar({ descriptionEdited: true });

    expect(screen.getByRole('button', { name: 'Description edited' })).toHaveClass('is-edited');
  });
});
