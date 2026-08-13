import { useMemo, useState } from 'react';
import { buildExportTraceReport } from '../utils/exportTrace.js';
import { EmptyState, SelectField, TextField } from './ui.jsx';

const LANE_LABELS = Object.freeze({ defs: 'Definitions', units: 'Units' });

function humanize(value) {
  return String(value || '')
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

export default function ExportTraceInspector({ compiledModules }) {
  const [lane, setLane] = useState('all');
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedTraceId, setSelectedTraceId] = useState('');
  const report = useMemo(() => buildExportTraceReport(compiledModules), [compiledModules]);
  const filteredTraces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return report.traces.filter(trace => (
      (lane === 'all' || trace.lane === lane)
      && (source === 'all' || trace.source === source)
      && (!normalizedQuery || [
        trace.label,
        trace.sourceIdentity,
        trace.sourceFeature,
        trace.category,
        trace.slotFieldName,
      ].some(value => String(value || '').toLowerCase().includes(normalizedQuery)))
    ));
  }, [lane, query, report.traces, source]);
  const selectedTrace = filteredTraces.find(trace => trace.id === selectedTraceId)
    || filteredTraces[0]
    || null;
  const deliveredPercent = report.summary.canonicalBlocks
    ? Math.round((report.summary.deliveredBlocks / report.summary.canonicalBlocks) * 100)
    : 0;

  return (
    <details className="export-console-config export-inspector export-inspector--trace export-trace-inspector">
      <summary className="export-inspector__summary">
        <span className="export-inspector__index" aria-hidden="true">T</span>
        <span className="export-inspector__heading">
          <small>Compiler provenance</small>
          <strong>Export Trace Inspector</strong>
          <em>Follow each editor change into its delivered lobby field</em>
        </span>
        <span className={`export-inspector__status ${report.summary.unpackedBlocks ? 'is-attention' : 'is-healthy'}`}>
          {report.summary.unpackedBlocks ? `${report.summary.unpackedBlocks} unpacked` : 'Fully traced'}
        </span>
        <span className="export-inspector__metrics" aria-label="Export trace summary">
          <span><small>Blocks</small><strong>{report.summary.canonicalBlocks}</strong></span>
          <span><small>Delivered</small><strong>{deliveredPercent}%</strong></span>
        </span>
      </summary>

      <div className="export-trace-inspector__body">
        <header className="export-trace-inspector__intro">
          <div>
            <strong>Source-to-delivery map</strong>
            <p>Choose a compiler block to inspect its origin, optimization path, dependencies, and numbered BAR destination.</p>
          </div>
          <dl aria-label="Export trace summary">
            <div><dt>Canonical</dt><dd>{report.summary.canonicalBlocks}</dd></div>
            <div><dt>Executed</dt><dd>{report.summary.executedBlocks}</dd></div>
            <div><dt>Merged</dt><dd>{report.summary.deduplicatedBlocks}</dd></div>
            <div className={report.summary.unpackedBlocks ? 'is-attention' : ''}><dt>Unpacked</dt><dd>{report.summary.unpackedBlocks}</dd></div>
          </dl>
        </header>

        <div className="export-trace-inspector__filters">
          <TextField
            label="Find contributor"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Unit, feature, block, or field"
          />
          <SelectField label="Output lane" value={lane} onChange={event => setLane(event.target.value)}>
            <option value="all">All lanes</option>
            <option value="defs">Definitions</option>
            <option value="units">Units</option>
          </SelectField>
          <SelectField label="Source" value={source} onChange={event => setSource(event.target.value)}>
            <option value="all">All sources</option>
            <option value="generated">Editor generated</option>
            <option value="imported">Imported module</option>
          </SelectField>
          <div className="export-trace-results" aria-live="polite">
            <small>Visible traces</small>
            <strong>{filteredTraces.length} / {report.traces.length}</strong>
          </div>
        </div>

        {selectedTrace ? (
          <div className="export-trace-workbench">
            <nav className="export-trace-index" aria-label="Compiler block traces">
              {filteredTraces.map(trace => (
                <button
                  type="button"
                  key={trace.id}
                  className={selectedTrace.id === trace.id ? 'is-active' : ''}
                  aria-pressed={selectedTrace.id === trace.id}
                  onClick={() => setSelectedTraceId(trace.id)}
                >
                  <span>{LANE_LABELS[trace.lane]} · {humanize(trace.category)}</span>
                  <strong>{trace.label}</strong>
                  <small>{trace.slotFieldName || 'Not packed'}</small>
                </button>
              ))}
            </nav>

            <section className="export-trace-detail" aria-live="polite">
              <header>
                <div>
                  <span>{LANE_LABELS[selectedTrace.lane]} · {humanize(selectedTrace.category)}</span>
                  <h5>{selectedTrace.label}</h5>
                  <code>{selectedTrace.id}</code>
                </div>
                <span className={`export-trace-status is-${selectedTrace.status}`}>
                  {selectedTrace.status === 'delivered'
                    ? 'Delivered'
                    : selectedTrace.status === 'blocked'
                      ? 'Blocked field'
                      : selectedTrace.status === 'overflow'
                        ? 'Overflow'
                        : 'Not packed'}
                </span>
              </header>

              <div className="export-trace-path" aria-label="Export trace path">
                <div>
                  <span>01 · Editor source</span>
                  <strong>{humanize(selectedTrace.sourceFeature)}</strong>
                  <small>{selectedTrace.sourceIdentity}</small>
                </div>
                <div>
                  <span>02 · Canonical block</span>
                  <strong>{humanize(selectedTrace.category)}</strong>
                  <small>{selectedTrace.rawBytes.toLocaleString()} raw bytes · {humanize(selectedTrace.stage)}</small>
                </div>
                <div>
                  <span>03 · Optimization</span>
                  <strong>{selectedTrace.deduplicated ? 'Merged with identical block' : 'Preserved independently'}</strong>
                  <small>{selectedTrace.effectiveBlockId || 'No effective block available'}</small>
                </div>
                <div className={selectedTrace.slotFieldName ? 'is-delivered' : 'is-unpacked'}>
                  <span>04 · Lobby delivery</span>
                  <strong>{selectedTrace.slotFieldName || 'No numbered field'}</strong>
                  <small>{selectedTrace.slotFieldName
                    ? `${selectedTrace.slotEncodedBytes.toLocaleString()} encoded chars · ${humanize(selectedTrace.compatibility)}`
                    : 'This block is outside the currently deliverable package.'}</small>
                </div>
              </div>

              {selectedTrace.dependencies.length > 0 && (
                <div className="export-trace-dependencies">
                  <span>Declared dependencies</span>
                  <div>{selectedTrace.dependencies.map(dependency => <code key={dependency}>{dependency}</code>)}</div>
                </div>
              )}
            </section>
          </div>
        ) : (
          <EmptyState
            compact
            title={report.traces.length ? 'No traces match these filters' : 'No compiler traces yet'}
            description={report.traces.length ? 'Clear the search or widen the lane and source filters.' : 'Enable an export subsystem or import a module to create compiler blocks.'}
          />
        )}
      </div>
    </details>
  );
}
