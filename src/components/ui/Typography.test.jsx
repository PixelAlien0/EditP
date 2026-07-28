import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Eyebrow, TechnicalText, Type } from './Typography.jsx';

describe('Typography', () => {
  it('renders semantic elements with a canonical hierarchy variant', () => {
    render(
      <>
        <Eyebrow>Production planning</Eyebrow>
        <Type as="h2" variant="page-title">Factory Roster Designer</Type>
        <TechnicalText as="code">armap</TechnicalText>
      </>,
    );

    expect(screen.getByText('Production planning')).toHaveClass('ui-type--eyebrow');
    expect(screen.getByRole('heading', { name: 'Factory Roster Designer' })).toHaveClass('ui-type--page-title');
    expect(screen.getByText('armap').tagName).toBe('CODE');
  });

  it('falls back to body styling for unknown variants', () => {
    render(<Type variant="unknown">Readable copy</Type>);
    expect(screen.getByText('Readable copy')).toHaveClass('ui-type--body');
  });
});
