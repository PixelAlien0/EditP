import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CloneCreatorDialog from './CloneCreatorDialog.jsx';

afterEach(cleanup);

function renderDialog(overrides = {}) {
  const props = {
    open: true,
    baseId: 'armflea',
    baseName: 'Flea',
    baseIconUrl: '/logo.svg',
    baseFaction: 'arm',
    baseTier: 't1',
    newId: '',
    name: 'Flea (Clone)',
    description: '',
    builders: [],
    autoAssignBuilders: false,
    onNewIdChange: vi.fn(),
    onNameChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onBuildersChange: vi.fn(),
    onAutoAssignChange: vi.fn(),
    onSubmit: vi.fn(event => event.preventDefault()),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<CloneCreatorDialog {...props} />);
  return props;
}

describe('CloneCreatorDialog', () => {
  it('presents source, identity, and production as one accessible workflow', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Clone Unit Creator' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Source chassis' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Name the new definition' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose its initial builders' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Parent Unit' })).toHaveValue('armflea');
    expect(screen.getByRole('textbox', { name: /New Unit ID/ })).toHaveFocus();
  });

  it('routes identity, production, submit, and close actions through explicit callbacks', async () => {
    const user = userEvent.setup();
    const props = renderDialog({ newId: 'armflea_plus' });

    await user.type(screen.getByRole('textbox', { name: /New Unit ID/ }), '_v2');
    expect(props.onNewIdChange).toHaveBeenCalled();

    await user.click(screen.getByRole('switch', { name: /Automatically assign/ }));
    expect(props.onAutoAssignChange).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Create Clone' }));
    expect(props.onSubmit).toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalled();
  });
});
