import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiscoveredKeyReviewWorkbench from './DiscoveredKeyReviewWorkbench.jsx';

describe('DiscoveredKeyReviewWorkbench', () => {
  beforeEach(() => localStorage.clear());

  it('filters source evidence and saves a non-authoritative local review', async () => {
    const user = userEvent.setup();
    render(<DiscoveredKeyReviewWorkbench onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Discovered-key review workbench' })).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Key, owner, sample, or source path…'), 'airfactory');
    await user.click(screen.getByRole('button', { name: /airfactory/i }));

    const decisionPanel = screen.getByText('Review decision').closest('aside');
    await user.selectOptions(within(decisionPanel).getByLabelText('Decision'), 'candidate');
    await user.type(within(decisionPanel).getByLabelText('Review notes'), 'Confirm runtime activation conditions.');
    await user.click(within(decisionPanel).getByRole('button', { name: 'Save local review' }));

    const stored = JSON.parse(localStorage.getItem('editp_discovered_key_reviews_v1'));
    expect(stored['unit:airfactory']).toMatchObject({
      decision: 'candidate',
      note: 'Confirm runtime activation conditions.',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Review saved locally.');
  });
});
