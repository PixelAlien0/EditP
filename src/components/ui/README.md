# BAR EditP UI Library

The UI library is the canonical source for reusable controls. Import from `components/ui.jsx` while legacy feature modules are migrated, or from `components/ui/index.js` in new modules.

## Primitives

- Actions: `Button`, `IconButton`, `ButtonGroup`
- Forms: `Field`, `TextField`, `TextAreaField`, `SelectField`, `Switch`, `SwitchField`
- Navigation: `Tabs`
- Status: `Badge`, `StatusBadge`, `Callout`, `Spinner`, `EmptyState`
- Structure: `PageShell`, `SectionHeader`, `Card`, `StatCard`, `Divider`
- Overlay: `Dialog` with focus trapping, Escape/backdrop close, scroll lock, and focus restoration

## Conventions

- Use semantic variants: `primary`, `secondary`, `quiet`, and `danger` for buttons; semantic tones for badges and callouts.
- Use `sm`, `md`, or `lg` component sizes. Do not add one-off control dimensions in feature CSS.
- Use a field component whenever a control has a visible label, description, or validation message.
- Use `SwitchField` for a visible setting row and `Switch` when surrounding feature copy already supplies the label.
- Feature CSS may control layout and width, but interactive, theme, focus, disabled, and error states belong to `ui.css`.
- All colors, spacing, radii, shadows, motion, and control sizes must come from `theme-tokens.css`.

## Example

```jsx
import { Button, SwitchField, TextField } from './components/ui.jsx';

<TextField label="Project name" value={name} onChange={event => setName(event.target.value)} />
<SwitchField label="Include build menus" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
<Button variant="primary" loading={saving} onClick={saveProject}>Save project</Button>
```
