import { useRef } from 'react';
import { cx } from './utils.js';

export function Tabs({ items, value, onChange, label, className, size = 'md' }) {
  const refs = useRef([]);
  const enabledItems = items.filter(item => !item.disabled);

  const handleKeyDown = (event, itemId) => {
    const currentIndex = enabledItems.findIndex(item => item.id === itemId);
    if (currentIndex < 0) return;
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % enabledItems.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = enabledItems.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextItem = enabledItems[nextIndex];
    onChange(nextItem.id);
    refs.current[items.findIndex(item => item.id === nextItem.id)]?.focus();
  };

  return (
    <div className={cx('ui-tabs', `ui-tabs--${size}`, className)} role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={node => { refs.current[index] = node; }}
          type="button"
          className={cx('ui-tab', item.id === value && 'is-active')}
          role="tab"
          aria-selected={item.id === value}
          aria-controls={item.panelId}
          tabIndex={item.id === value ? 0 : -1}
          disabled={item.disabled}
          onClick={() => onChange(item.id)}
          onKeyDown={event => handleKeyDown(event, item.id)}
        >
          <span>{item.label}</span>{item.count !== undefined && <span className="ui-tab__count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
