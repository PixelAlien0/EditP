import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OnlinePresenceBadge from './OnlinePresenceBadge.jsx';
import { PRESENCE_ACTIVITY } from '../config/presenceActivities.js';

const activityCounts = {
  [PRESENCE_ACTIVITY.MAIN_MENU]: 1,
  [PRESENCE_ACTIVITY.EDIT_UNITS]: 2,
  [PRESENCE_ACTIVITY.BUILD_MENUS]: 1,
  [PRESENCE_ACTIVITY.REVIEW_EXPORT]: 0,
  [PRESENCE_ACTIVITY.TOOLS]: 0,
  [PRESENCE_ACTIVITY.OTHER]: 0
};

describe('OnlinePresenceBadge', () => {
  it('opens an accessible activity breakdown and closes with Escape', () => {
    render(
      <OnlinePresenceBadge
        count={4}
        status="connected"
        activityCounts={activityCounts}
        currentActivity={PRESENCE_ACTIVITY.EDIT_UNITS}
      />
    );

    const trigger = screen.getByRole('button', { name: '4 editors online' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Editor activity breakdown' })).toBeInTheDocument();
    expect(screen.getByText('You are here')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Editor activity breakdown' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('does not render when Supabase is unconfigured', () => {
    const { container } = render(<OnlinePresenceBadge count={null} status="unconfigured" />);
    expect(container).toBeEmptyDOMElement();
  });
});
