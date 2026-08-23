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
      <svg viewBox="0 0 760 280" preserveAspectRatio="xMaxYMid slice">
        <path
          className="main-menu__signal-guide"
          data-project-signal-guide
          pathLength="1"
          d="M88 212 C218 212 264 88 414 88 S560 164 652 140"
        />
        <path
          className="main-menu__signal-guide is-secondary"
          data-project-signal-guide
          pathLength="1"
          d="M192 238 C318 238 350 154 468 154 S582 96 702 116"
        />
        <g className="main-menu__signal-orbits" transform="translate(652 140)">
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
