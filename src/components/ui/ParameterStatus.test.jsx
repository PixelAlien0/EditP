import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ParameterStatus } from './ParameterStatus.jsx';

describe('ParameterStatus', () => {
  it('renders value and runtime provenance together', () => {
    render(<ParameterStatus modified capabilityIds={['bar-gadget']} />);

    expect(screen.getByLabelText('Parameter status: Edited, Gadget')).toBeInTheDocument();
    expect(screen.getByText('Edited')).toBeVisible();
    expect(screen.getByText('Gadget')).toBeVisible();
  });
});

