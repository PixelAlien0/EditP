import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BarUpdateCenterPage from './BarUpdateCenterPage.jsx';

afterEach(cleanup);

describe('BarUpdateCenterPage', () => {
  it('explains the bundled snapshot delta without presenting a live updater', () => {
    render(<BarUpdateCenterPage onBack={vi.fn()} onOpenReference={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'BAR Update Center' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reference coverage was refreshed' })).toBeInTheDocument();
    expect(screen.getByText('Unit artwork mappings').closest('article')).toHaveTextContent('2 changed');
    expect(screen.getByText('Custom parameter contracts').closest('article')).toHaveTextContent('2 changed');
    expect(screen.getByText(/does not contact GitHub or replace project data at runtime/i)).toBeInTheDocument();
  });

  it('routes back to editing and into the reference library', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onOpenReference = vi.fn();
    render(<BarUpdateCenterPage onBack={onBack} onOpenReference={onOpenReference} />);

    await user.click(screen.getByRole('button', { name: 'Back to editor' }));
    await user.click(screen.getByRole('button', { name: 'Open reference library' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onOpenReference).toHaveBeenCalledOnce();
  });
});
