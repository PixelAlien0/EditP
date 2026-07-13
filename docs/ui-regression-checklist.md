# BAR Editor UI regression checklist

Use this checklist after changing shared controls, workspace layout, or theme tokens.

## Viewports and themes

- Check light and dark themes at 1920×1080, 1440px, 1180px, and 1024px wide.
- Confirm the document has no horizontal overflow; the unit context rail may scroll horizontally below its natural width.
- Confirm header workflow navigation and utility actions never overlap or wrap into a second row.

## Keyboard and accessibility

- Tab through the header, sidebar filters, unit list, parameter help, stat controls, weapon slots, and Changes drawer.
- Confirm every focusable control has a visible sakura focus ring and all switches have an accessible name.
- Open and close the Tools menu with click and Escape; verify focus remains predictable.
- Verify reduced-motion mode removes nonessential transitions and animation.

## Editor workflows

- Edit and reset numeric and boolean unit parameters; edited cards must remain distinct in both themes.
- Clear the final custom unit description, reload, and confirm the removed description does not return.
- Change weapon slots, target categories, clone identity, and build menus; confirm Review & Export reflects each change.
- Save and load project JSON, apply a preset, and test undo/redo without losing synchronized clone or roster data.

## Pages and performance

- Open Build Menus, Preset Gallery, and Review & Export; verify the loading state does not shift the header.
- Confirm Preset Gallery and Review & Export load as separate production chunks.
- Run `npm run lint` and `npm run build`; do not accept new warnings other than the documented chunk-size advisory.
