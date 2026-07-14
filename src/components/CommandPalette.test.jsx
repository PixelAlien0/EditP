import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CommandPalette from './CommandPalette.jsx';

describe('CommandPalette', () => {
  it('filters and runs commands from the keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette commands={[
      { id: 'edit', kind: 'Workspace', label: 'Edit units', description: 'Open editor', onSelect: vi.fn() },
      { id: 'health', kind: 'Parameter', label: 'Health', description: 'Durability', onSelect },
    ]} onClose={onClose} />);

    const search = screen.getByRole('combobox');
    await user.type(search, 'health');
    expect(screen.getByRole('option', { name: /Health/ })).toBeVisible();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
