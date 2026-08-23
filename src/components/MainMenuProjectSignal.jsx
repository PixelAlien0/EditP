const clamp01 = value => Math.min(1, Math.max(0, value));

function signalArc(value, reference) {
  if (value <= 0) return 5;
  return Math.round(12 + (clamp01(Math.log1p(value) / Math.log1p(reference)) * 70));
}

export default function MainMenuProjectSignal({ changes, clones, rosters }) {
  const signals = [
    { id: 'changes', value: changes, reference: 180, radius: 112 },
    { id: 'clones', value: clones, reference: 24, radius: 82 },
    { id: 'rosters', value: rosters, reference: 36, radius: 52 },
  ];

  return (
    <div className="main-menu__project-signal" data-gsap-signal aria-hidden="true">
      <svg viewBox="0 0 520 250" preserveAspectRatio="xMaxYMid slice">
        <g transform="translate(412 125)">
          {signals.map(({ id, value, reference, radius }) => (
            <g key={id}>
              <circle className="main-menu__signal-track" r={radius} pathLength="100" />
              <circle
                className="main-menu__signal-ring"
                data-project-signal={id}
                data-signal-value={value}
                r={radius}
                pathLength="100"
                strokeDasharray={`${signalArc(value, reference)} 100`}
              />
            </g>
          ))}
          <circle className="main-menu__signal-core" r="3" />
        </g>
      </svg>
    </div>
  );
}
