import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ParameterMatrix } from './ParameterCanvas.jsx';

describe('ParameterMatrix capability labels', () => {
  it('shows group context, capabilities, field totals, and edited totals', () => {
    const onToggleGroup = vi.fn();
    render(
      <ParameterMatrix
        sectionId="weapons"
        parameters={[
          {
            key: 'carried_unit',
            group: 'Carrier deployment',
            groupDescription: 'Deploy and control carried units through BAR’s carrier contract.',
            capabilities: ['bar-gadget', 'experimental'],
          },
          {
            key: 'maxunits',
            group: 'Carrier deployment',
            capabilities: ['bar-gadget', 'experimental'],
          },
        ]}
        collapsedGroups={{}}
        onToggleGroup={onToggleGroup}
        isParameterModified={parameter => parameter.key === 'maxunits'}
        renderParameter={parameter => <div key={parameter.key}>{parameter.key}</div>}
      />,
    );

    expect(screen.getByLabelText('Capabilities: BAR gadget, Experimental')).toBeInTheDocument();
    const heading = screen.getByRole('button', { name: /carrier deployment/i });
    expect(heading).toHaveTextContent('Deploy and control carried units');
    expect(heading).toHaveTextContent('2 fields');
    expect(heading).toHaveTextContent('1 edited');
    expect(heading).toHaveAttribute('aria-controls', 'parameter-group-weapons-carrier-deployment');
    expect(screen.getByRole('region', { name: 'Carrier deployment parameters' })).toBeInTheDocument();

    fireEvent.click(heading);
    expect(onToggleGroup).toHaveBeenCalledWith('weapons:Carrier deployment');
  });
});
