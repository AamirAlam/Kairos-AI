import { ImageResponse } from 'next/og';

export const alt = 'Kairos — autonomous AI trading agent on BSC';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          background: 'radial-gradient(120% 120% at 30% 30%, #13131f 0%, #09090b 60%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Icon mark */}
        <svg width="120" height="120" viewBox="0 0 100 100" style={{ marginBottom: 40 }}>
          <line x1="32" y1="80" x2="32" y2="20" stroke="#818cf8" strokeWidth="5" strokeLinecap="round" />
          <polyline points="25.5,31 32,19 38.5,31" fill="none" stroke="#c7d2fe" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M 32 48 C 48 44 60 32 76 18" fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 32 48 C 48 52 60 64 76 80" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="76" cy="18" r="4" fill="#34d399" />
          <circle cx="76" cy="80" r="4" fill="#38bdf8" />
          <circle cx="32" cy="48" r="7" fill="#3730a3" />
          <circle cx="32" cy="48" r="3" fill="#a5b4fc" />
        </svg>

        <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, color: '#e0e7ff', letterSpacing: 8 }}>
          KAIROS
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#818cf8', marginTop: 8, letterSpacing: 2 }}>
          See the moment. Seize it.
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: '#52525b', marginTop: 40 }}>
          Autonomous AI trading agent · self-custody on BNB Smart Chain
        </div>
      </div>
    ),
    { ...size },
  );
}
