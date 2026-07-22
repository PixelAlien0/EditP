import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getParameterHelp,
  getParameterRelationship,
  getRelationshipLabel,
  PARAMETER_SECTION_GUIDANCE,
} from '../../config/parameterGuidance.js';
import '../../styles/features/parameter-guidance.css';
export function ParameterRelationshipPanel({ section, activeKey, onSelect, onClear }) {
  if (!activeKey) {
    return (
      <aside className="parameter-relationship-panel is-empty" aria-label="Contextual parameter relationships">
        <div><span>Parameter relationships</span><small>Focus or click a parameter to reveal the values that should be tuned with it.</small></div>
      </aside>
    );
  }
  const relationship = getParameterRelationship(section, activeKey);
  if (!relationship) {
    return (
      <aside className="parameter-relationship-panel is-empty" aria-live="polite">
        <div><span>{getRelationshipLabel(activeKey)}</span><small>No direct dependency group is mapped for this parameter.</small></div>
        <button type="button" className="parameter-relationship-clear" onClick={onClear} aria-label="Clear selected parameter">×</button>
      </aside>
    );
  }
  return (
    <aside className="parameter-relationship-panel" aria-live="polite">
      <div className="parameter-relationship-copy">
        <span>{relationship.title}</span>
        <small>{relationship.description}</small>
      </div>
      <div className="parameter-relationship-links" aria-label={`Related to ${getRelationshipLabel(activeKey)}`}>
        <em>{getRelationshipLabel(activeKey)}</em>
        {relationship.keys.filter(key => key !== activeKey).map(key => (
          <button type="button" key={key} onClick={() => onSelect(key)}>{getRelationshipLabel(key)}</button>
        ))}
      </div>
      <button type="button" className="parameter-relationship-clear" onClick={onClear} aria-label="Clear selected parameter">×</button>
    </aside>
  );
}

export function ComparisonValue({ active, before, after, beforeLabel = 'Inherited' }) {
  if (!active) return null;
  const display = value => value === undefined || value === '' ? beforeLabel : String(value);
  return (
    <div className="before-after-value" aria-label={`Before ${display(before)}, after ${display(after)}`}>
      <span><small>Before</small><strong>{display(before)}</strong></span>
      <i aria-hidden="true">→</i>
      <span><small>After</small><strong>{display(after)}</strong></span>
    </div>
  );
}

export function ParameterHelp({ paramKey, label, onOpen }) {
  const help = getParameterHelp(paramKey, label);
  const triggerRef = useRef(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(null);

  const updateTooltipPosition = useCallback(() => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;
    const viewportInset = 12;
    const tooltipWidth = Math.min(260, window.innerWidth - viewportInset * 2);
    const hasRoomAbove = triggerRect.top - 72 >= viewportInset;
    const left = Math.min(
      Math.max(triggerRect.left + triggerRect.width / 2, tooltipWidth / 2 + viewportInset),
      window.innerWidth - tooltipWidth / 2 - viewportInset
    );
    setTooltipPosition({
      left,
      top: hasRoomAbove ? triggerRect.top - 8 : triggerRect.bottom + 8,
      placement: hasRoomAbove ? 'above' : 'below'
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);
    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
    };
  }, [isOpen, updateTooltipPosition]);

  return (
    <span className="parameter-help">
      <button
        ref={triggerRef}
        type="button"
        className="parameter-help-trigger"
        aria-label={`Help: ${label}`}
        aria-describedby={isOpen ? tooltipId : undefined}
        onPointerEnter={() => setIsOpen(true)}
        onPointerLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={() => {
          setIsOpen(true);
          onOpen?.(paramKey);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
            event.currentTarget.blur();
          }
        }}
      >
        ?
      </button>
      {isOpen && tooltipPosition && createPortal(
        <span
          id={tooltipId}
          className={`parameter-help-tooltip parameter-help-tooltip--floating parameter-help-tooltip--${tooltipPosition.placement}`}
          role="tooltip"
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
        >
          {help}
        </span>,
        document.body
      )}
    </span>
  );
}

export function ParameterGuide({ section }) {
  return (
    <details className="editor-parameter-guide">
      <summary>Parameter guide</summary>
      <p>{PARAMETER_SECTION_GUIDANCE[section] || PARAMETER_SECTION_GUIDANCE.structure}</p>
      <p><strong>How to change:</strong> enter a value or choose a state. Edited cards are marked; use Reset or × to restore the inherited value.</p>
    </details>
  );
}
