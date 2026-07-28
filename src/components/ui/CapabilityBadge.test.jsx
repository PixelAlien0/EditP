import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CapabilityLabels } from './CapabilityBadge.jsx';

describe('CapabilityLabels', () => {
  it('renders concise visible labels with full accessible context', () => {
    render(<CapabilityLabels capabilityIds={['bar-gadget', 'experimental']} compact />);

    expect(screen.getByLabelText('Capabilities: BAR gadget, Experimental')).toBeInTheDocument();
    expect(screen.getByText('Gadget')).toHaveAttribute(
      'title',
      'Requires behavior supplied by a BAR LuaRules gadget.',
    );
    expect(screen.getByText('Experimental')).toBeInTheDocument();
  });

  it('renders nothing when no capability metadata exists', () => {
    const { container } = render(<CapabilityLabels featureId="missing-feature" />);
    expect(container).toBeEmptyDOMElement();
  });
});
