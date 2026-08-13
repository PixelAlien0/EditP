import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ValidationCenter from './ValidationCenter.jsx';

const ISSUES = [
  { id: 'error-1', unitId: 'armflea', unitName: 'Flea', key: 'weapon_slot_1_range', level: 'error', message: 'Range must be positive.' },
  { id: 'warning-1', unitId: 'armflash', unitName: 'Flash', key: 'customparams.controlradius', level: 'warning', message: 'Runtime defaults will be used.' },
  { id: 'info-1', unitId: 'project', unitName: 'Project', key: 'weapon_library', level: 'info', message: 'Stored weapon is not equipped.' },
];

describe('ValidationCenter', () => {
  it('groups findings by severity and exposes the blocking status', () => {
    render(<ValidationCenter issues={ISSUES} />);

    expect(screen.getByText('Export blocked')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Blockers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Warnings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advisories' })).toBeInTheDocument();
    expect(screen.getByText('Weapon 1 · range')).toBeInTheDocument();
  });

  it('opens resolvable unit findings without offering a project-level action', async () => {
    const user = userEvent.setup();
    const onEditUnit = vi.fn();
    render(<ValidationCenter issues={ISSUES} onEditUnit={onEditUnit} />);

    const actions = screen.getAllByRole('button', { name: 'Open unit' });
    expect(actions).toHaveLength(2);
    await user.click(actions[0]);
    expect(onEditUnit).toHaveBeenCalledWith('armflea');
  });

  it('shows a clear ready state when there are no findings', () => {
    render(<ValidationCenter issues={[]} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('No validation issues detected')).toBeInTheDocument();
  });
});
