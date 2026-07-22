import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CreditsModal from './CreditsModal.jsx';

describe('CreditsModal', () => {
  it('keeps attribution and dismissal behavior inside the extracted dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CreditsModal onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: 'Disclaimer & credits' })).toBeVisible();
    const gameDataSource = screen.getAllByRole('link').find(
      link => link.getAttribute('href') === 'https://github.com/beyond-all-reason/Beyond-All-Reason'
    );
    expect(gameDataSource).toBeVisible();
    expect(screen.getByText('Maintained by [Grump]SunlessK')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
