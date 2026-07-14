import { Children, cloneElement, isValidElement, useCallback } from 'react';
import { WORKSPACE_LAYOUT_LIMITS } from '../../hooks/useWorkspaceLayout.js';

function PaneSeparator({ side, value, onChange, controls, disabled }) {
  const limits = WORKSPACE_LAYOUT_LIMITS[side];
  const direction = side === 'left' ? 1 : -1;

  const handleKeyDown = event => {
    let next = value;
    if (event.key === 'ArrowLeft') next -= 8 * direction;
    else if (event.key === 'ArrowRight') next += 8 * direction;
    else if (event.key === 'Home') next = limits.min;
    else if (event.key === 'End') next = limits.max;
    else return;
    event.preventDefault();
    onChange(next);
  };

  const handlePointerDown = event => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = value;
    const cursorBefore = document.body.style.cursor;
    const selectBefore = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = moveEvent => {
      onChange(startWidth + ((moveEvent.clientX - startX) * direction));
    };
    const finish = () => {
      document.body.style.cursor = cursorBefore;
      document.body.style.userSelect = selectBefore;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', finish, { once: true });
  };

  return (
    <div
      className={`workspace-pane-resizer workspace-pane-resizer--${side}`}
      role="separator"
      aria-label={`Resize ${side === 'left' ? 'unit library' : 'editor inspector'}`}
      aria-orientation="vertical"
      aria-controls={controls}
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      aria-valuenow={Math.round(value)}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    >
      <span aria-hidden="true" />
    </div>
  );
}

export default function EditorShell({ layout, actions, children }) {
  const [library, canvas, inspector] = Children.toArray(children);
  const closeOverlayPanes = useCallback(() => {
    if (actions.closeOverlayPanes) actions.closeOverlayPanes();
    else {
      actions.setLeftCollapsed(true);
      actions.setRightCollapsed(true);
    }
  }, [actions]);

  const style = {
    '--workspace-left-width': `${layout.leftWidth}px`,
    '--workspace-right-width': `${layout.rightWidth}px`,
  };
  const libraryPane = isValidElement(library)
    ? cloneElement(library, { compact: layout.leftWidth <= 232 })
    : library;

  return (
    <div
      className={`main-layout editor-shell density-${layout.density} ${layout.leftCollapsed ? 'is-library-collapsed' : 'is-library-open'} ${layout.rightCollapsed ? 'is-inspector-collapsed' : 'is-inspector-open'}`}
      style={style}
    >
      {libraryPane}
      <PaneSeparator
        side="left"
        value={layout.leftWidth}
        onChange={actions.setLeftWidth}
        controls="unit-library-pane"
        disabled={layout.leftCollapsed}
      />
      {canvas}
      <PaneSeparator
        side="right"
        value={layout.rightWidth}
        onChange={actions.setRightWidth}
        controls="editor-inspector-pane"
        disabled={layout.rightCollapsed}
      />
      {inspector}
      <button
        type="button"
        className="workspace-pane-scrim"
        aria-label="Close open workspace panel"
        onClick={closeOverlayPanes}
      />
    </div>
  );
}
