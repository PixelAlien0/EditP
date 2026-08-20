import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, FileButton } from './Button.jsx';

describe('Button', () => {
  it('renders the canonical hierarchy classes', () => {
    render(<Button variant="primary" size="lg">Save project</Button>);

    expect(screen.getByRole('button', { name: 'Save project' })).toHaveClass(
      'ui-button',
      'ui-button--primary',
      'ui-button--lg',
    );
  });

  it('normalizes legacy ghost and small aliases', () => {
    render(<Button variant="ghost" size="small">Reset</Button>);

    expect(screen.getByRole('button', { name: 'Reset' })).toHaveClass(
      'ui-button--quiet',
      'ui-button--sm',
    );
  });

  it('normalizes aliases for file actions too', () => {
    render(<FileButton variant="ghost" size="small">Load project</FileButton>);

    expect(screen.getByText('Load project').closest('label')).toHaveClass(
      'ui-button--quiet',
      'ui-button--sm',
    );
  });
});
