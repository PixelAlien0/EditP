import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CustomParameterControl from './CustomParameterControl.jsx';

describe('CustomParameterControl', () => {
  it('renders boolean contracts as accessible switches', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CustomParameterControl
        definition={{ key: 'crashable', label: 'Crashable', type: 'boolean' }}
        value={false}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('switch', { name: 'Crashable' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders accepted contract values as a select', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CustomParameterControl
        definition={{ key: 'scavsquadrarity', label: 'Scavenger Rarity', type: 'string', acceptedValues: ['basic', 'special'] }}
        value="basic"
        onChange={onChange}
      />
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Scavenger Rarity value' }), 'special');
    expect(onChange).toHaveBeenCalledWith('special');
  });

  it('selects a validated UnitDef through the reference picker', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CustomParameterControl
        definition={{ key: 'spawns_name', label: 'Spawned unit', type: 'string' }}
        value=""
        onChange={onChange}
        referenceCatalogs={{ units: [{ id: 'corak', label: 'Grunt', detail: 'COR / T1' }], weapons: [] }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Browse' }));
    expect(screen.getByRole('dialog', { name: 'Choose a UnitDef' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Grunt/ }));
    expect(onChange).toHaveBeenCalledWith('corak');
  });
});
