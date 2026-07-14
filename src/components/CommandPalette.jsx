import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, IconButton } from './ui.jsx';
import '../styles/features/command-palette.css';

const MAX_RESULTS = 14;

export default function CommandPalette({ commands, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => {
    const scored = commands.flatMap(command => {
      const haystack = `${command.label} ${command.description || ''} ${command.keywords || ''}`.toLowerCase();
      if (!normalizedQuery) return [{ command, score: command.priority || 0 }];
      const label = command.label.toLowerCase();
      const index = haystack.indexOf(normalizedQuery);
      if (index < 0) return [];
      return [{ command, score: (label.startsWith(normalizedQuery) ? 100 : 0) - index + (command.priority || 0) }];
    });
    return scored.sort((left, right) => right.score - left.score).slice(0, MAX_RESULTS).map(item => item.command);
  }, [commands, normalizedQuery]);

  useEffect(() => setActiveIndex(0), [normalizedQuery]);

  const selectCommand = command => {
    command.onSelect();
    onClose();
  };

  return (
    <Dialog
      onClose={onClose}
      initialFocusRef={inputRef}
      overlayClassName="command-palette-overlay"
      className="command-palette"
      labelledBy="command-palette-title"
    >
      <header className="command-palette__header">
        <div>
          <span>Quick navigation</span>
          <h2 id="command-palette-title">Command palette</h2>
        </div>
        <IconButton variant="quiet" label="Close command palette" onClick={onClose}>×</IconButton>
      </header>
      <div className="command-palette__search">
        <span aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex(index => Math.min(results.length - 1, index + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex(index => Math.max(0, index - 1));
            } else if (event.key === 'Enter' && results[activeIndex]) {
              event.preventDefault();
              selectCommand(results[activeIndex]);
            }
          }}
          placeholder="Search units, parameters, tools, or workspaces…"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="command-palette-results"
          aria-activedescendant={results[activeIndex] ? `command-result-${results[activeIndex].id}` : undefined}
        />
        <kbd>Ctrl K</kbd>
      </div>
      <div id="command-palette-results" className="command-palette__results" role="listbox" aria-label="Matching commands">
        {results.map((command, index) => (
          <button
            id={`command-result-${command.id}`}
            key={command.id}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={index === activeIndex ? 'is-active' : ''}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => selectCommand(command)}
          >
            <span className="command-palette__kind">{command.kind}</span>
            <span><strong>{command.label}</strong><small>{command.description}</small></span>
            {command.hint && <kbd>{command.hint}</kbd>}
          </button>
        ))}
        {results.length === 0 && <p className="command-palette__empty">No matching command or parameter.</p>}
      </div>
      <footer className="command-palette__footer"><span>↑↓ Navigate</span><span>Enter Open</span><span>Esc Close</span></footer>
    </Dialog>
  );
}
