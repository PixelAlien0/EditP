import { Badge } from '../ui.jsx';

export default function GadgetContractSummary({ results = [] }) {
  return (
    <section className="inspector-section-card gadget-contract-summary" aria-labelledby="gadget-contract-summary-title">
      <div className="inspector-section-heading">
        <span id="gadget-contract-summary-title">BAR runtime contracts</span>
        <small>{results.length} detected</small>
      </div>
      {results.length === 0 ? (
        <p className="inspector-empty-copy">No registered gadget contract is active on this UnitDef or its weapon slots.</p>
      ) : (
        <div className="gadget-contract-summary__list">
          {results.map(result => (
            <article key={result.id} className={`gadget-contract-summary__item is-${result.status}`}>
              <div className="gadget-contract-summary__heading">
                <div>
                  <strong>{result.label}</strong>
                  <small>{result.slotNumber === null ? 'UnitDef' : `Weapon slot ${result.slotNumber}`}</small>
                </div>
                <Badge tone={result.tone} size="sm">{result.statusLabel}</Badge>
              </div>
              <p>{result.description}</p>
              {result.problems.length > 0 && (
                <ul>
                  {result.problems.map((problem, index) => (
                    <li key={`${problem.key}-${index}`}>
                      <span>{problem.message}</span>
                      {problem.suggestedFix && <small className="inspector-empty-copy">{problem.suggestedFix}</small>}
                    </li>
                  ))}
                </ul>
              )}
              <code title={result.source.path}>{result.source.path.split('/').at(-1)}</code>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
