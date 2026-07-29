import { memo, useEffect, useMemo, useRef, useState } from 'react';
import UnitArtwork from '../UnitArtwork.jsx';

const ROW_HEIGHT = 64;
const OVERSCAN_ROWS = 6;
const FALLBACK_VIEWPORT_ROWS = 18;

const UnitListRow = memo(function UnitListRow({
  unit,
  active,
  modified,
  disabled,
  iconUrl,
  onSelect,
}) {
  return (
    <button
      type="button"
      className={`unit-item ${active ? 'active' : ''}`}
      onClick={() => onSelect(unit.id)}
      aria-pressed={active}
      style={{ height: `${ROW_HEIGHT}px` }}
    >
      <div className="unit-item-icon">
        <UnitArtwork src={iconUrl} alt="" />
      </div>
      <div className="unit-item-info">
        <div className="unit-item-header">
          <span className="unit-item-name">{unit.name}</span>
          {modified && <span className="unit-status unit-status--modified">MOD</span>}
          {disabled && <span className="unit-status unit-status--disabled">DIS</span>}
        </div>
        <span className="unit-item-id">{unit.id}</span>
      </div>
      <span className="unit-tier">{unit.techTier.toUpperCase()}</span>
    </button>
  );
});

export default memo(function VirtualizedUnitList({
  units,
  selectedUnitId,
  modifiedUnitIds,
  disabledUnitIds,
  getUnitIconUrl,
  onSelectUnit,
  onClearFilters,
  resetKey,
}) {
  const containerRef = useRef(null);
  const animationFrameRef = useRef(0);
  const unitsLengthRef = useRef(units.length);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [visiblePosition, setVisiblePosition] = useState({ start: 0, visibleEnd: 0 });
  unitsLengthRef.current = units.length;

  const modifiedIds = useMemo(() => new Set(modifiedUnitIds), [modifiedUnitIds]);
  const disabledIds = useMemo(() => new Set(disabledUnitIds), [disabledUnitIds]);
  const viewportRows = Math.max(
    1,
    Math.ceil((viewportHeight || ROW_HEIGHT * FALLBACK_VIEWPORT_ROWS) / ROW_HEIGHT),
  );
  const rangeStart = Math.max(0, visiblePosition.start - OVERSCAN_ROWS);
  const rangeEnd = Math.min(units.length, visiblePosition.visibleEnd + OVERSCAN_ROWS);
  const visibleUnits = units.slice(rangeStart, rangeEnd);
  const remaining = Math.max(0, units.length - visiblePosition.visibleEnd);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const updateViewport = () => {
      const nextHeight = container.clientHeight;
      setViewportHeight(previous => previous === nextHeight ? previous : nextHeight);
      const start = Math.floor(container.scrollTop / ROW_HEIGHT);
      const visibleEnd = Math.min(units.length, start + Math.max(1, Math.ceil(nextHeight / ROW_HEIGHT)));
      setVisiblePosition(previous => (
        previous.start === start && previous.visibleEnd === visibleEnd
          ? previous
          : { start, visibleEnd }
      ));
    };

    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(container);
    return () => observer.disconnect();
  }, [units.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = 0;
    const rows = Math.max(1, Math.ceil((container.clientHeight || ROW_HEIGHT * FALLBACK_VIEWPORT_ROWS) / ROW_HEIGHT));
    setVisiblePosition({ start: 0, visibleEnd: Math.min(unitsLengthRef.current, rows) });
  }, [resetKey]);

  useEffect(() => () => cancelAnimationFrame(animationFrameRef.current), []);

  const handleScroll = event => {
    const container = event.currentTarget;
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(() => {
      const start = Math.floor(container.scrollTop / ROW_HEIGHT);
      const visibleEnd = Math.min(units.length, start + viewportRows);
      setVisiblePosition(previous => (
        previous.start === start && previous.visibleEnd === visibleEnd
          ? previous
          : { start, visibleEnd }
      ));
    });
  };

  return (
    <div className="unit-list-region">
      <div ref={containerRef} className="unit-list-container" onScroll={handleScroll}>
        {units.length === 0 ? (
          <div className="unit-list-empty">
            <strong>No matching units</strong>
            <span>Try removing a category or clearing the current filters.</span>
            <button className="filter-action-btn active" onClick={onClearFilters}>Clear all filters</button>
          </div>
        ) : (
          <div className="unit-list-virtual" style={{ height: `${units.length * ROW_HEIGHT}px` }}>
            <div className="unit-list" style={{ transform: `translateY(${rangeStart * ROW_HEIGHT}px)` }}>
              {visibleUnits.map(unit => (
                <UnitListRow
                  key={unit.id}
                  unit={unit}
                  active={selectedUnitId === unit.id}
                  modified={modifiedIds.has(unit.id)}
                  disabled={disabledIds.has(unit.id)}
                  iconUrl={getUnitIconUrl(unit.id)}
                  onSelect={onSelectUnit}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {remaining > 0 && (
        <div className="unit-scroll-hint" aria-hidden="true">
          <svg viewBox="0 0 16 16"><path d="M8 3.25v8.5" /><path d="m4.75 8.5 3.25 3.25 3.25-3.25" /></svg>
          <span>Continue browsing</span>
          <strong>{remaining.toLocaleString()} remaining</strong>
        </div>
      )}
    </div>
  );
});
