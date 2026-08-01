import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch.jsx';

describe('Switch', () => {
  it('keeps its input isolated from native checkbox styling', () => {
    render(<Switch label="Parameter tweaks" checked={false} onChange={() => {}} />);

    expect(screen.getByRole('switch', { name: 'Parameter tweaks' })).toHaveClass('ui-switch-input');
  });

  it('remains keyboard and pointer operable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Header comments" checked={false} onChange={onChange} />);

    await user.click(screen.getByRole('switch', { name: 'Header comments' }));
    expect(onChange).toHaveBeenCalledOnce();
  });
});
