import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui.jsx';

export default function UnitDescriptionEditor({
  unitId,
  unitName,
  inheritedDescription = '',
  value = '',
  onCommit,
}) {
  const persistedValue = typeof value === 'string' ? value : '';
  const [draft, setDraft] = useState(persistedValue);
  const dirty = draft !== persistedValue;
  const hasOverride = persistedValue.length > 0;

  useEffect(() => {
    setDraft(persistedValue);
  }, [persistedValue, unitId]);

  const commitDraft = useCallback(() => {
    if (!dirty) return;
    onCommit(draft);
  }, [dirty, draft, onCommit]);

  const handleEditorBlur = event => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    commitDraft();
  };

  return (
    <section className="inspector-section-card" onBlur={handleEditorBlur}>
      <div className="inspector-section-heading">
        <span>Unit description</span>
        <small>{dirty ? 'Unsaved draft' : hasOverride ? 'Edited in this project' : 'Inherited from BAR'}</small>
      </div>
      <textarea
        id="selected-unit-description"
        className="form-input inspector-description-field"
        aria-label={`Custom description for ${unitName}`}
        placeholder={inheritedDescription || 'No chassis description available.'}
        value={draft}
        maxLength={1000}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            commitDraft();
          } else if (event.key === 'Escape' && dirty) {
            event.preventDefault();
            setDraft(persistedValue);
          }
        }}
      />
      <div className="inspector-description-actions">
        <small>{draft.length} / 1000 characters</small>
        <div className="inspector-description-actions__buttons">
          <Button
            variant="ghost"
            size="sm"
            disabled={!dirty}
            onClick={() => setDraft(persistedValue)}
          >
            Cancel draft
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasOverride && !dirty}
            onClick={() => {
              setDraft('');
              if (hasOverride) onCommit('');
            }}
          >
            Restore inherited
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty}
            onClick={commitDraft}
          >
            Apply description
          </Button>
        </div>
      </div>
      <small className="inspector-description-shortcut">
        Changes apply when focus leaves this editor. Press Ctrl+Enter to apply immediately.
      </small>
    </section>
  );
}
