import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ParameterMatrix } from './ParameterCanvas.jsx';

describe('ParameterMatrix capability labels', () => {
  it('shows the runtime contract shared by parameters in a group', () => {
    render(
      <ParameterMatrix
        sectionId="weapons"
        parameters={[
          {
            key: 'carried_unit',
            group: 'Carrier deployment',
            capabilities: ['bar-gadget', 'experimental'],
          },
          {
            key: 'maxunits',
            group: 'Carrier deployment',
            capabilities: ['bar-gadget', 'experimental'],
          },
        ]}
        collapsedGroups={{}}
        onToggleGroup={vi.fn()}
        renderParameter={parameter => <div key={parameter.key}>{parameter.key}</div>}
      />,
    );

    expect(screen.getByLabelText('Capabilities: BAR gadget, Experimental')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /carrier deployment/i })).toHaveTextContent('2 fields');
  });
});
