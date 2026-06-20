import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(120% 120% at 38% 40%, #13131f 0%, #09090b 100%)',
        }}
      >
        <svg width="150" height="150" viewBox="0 0 100 100">
          <line x1="32" y1="80" x2="32" y2="20" stroke="#818cf8" strokeWidth="5" strokeLinecap="round" />
          <polyline points="25.5,31 32,19 38.5,31" fill="none" stroke="#c7d2fe" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M 32 48 C 48 44 60 32 76 18" fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 32 48 C 48 52 60 64 76 80" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="76" cy="18" r="4.5" fill="#34d399" />
          <circle cx="76" cy="80" r="4.5" fill="#38bdf8" />
          <circle cx="32" cy="48" r="8" fill="#1e1b4b" />
          <circle cx="32" cy="48" r="5" fill="#4338ca" />
          <circle cx="32" cy="48" r="2.5" fill="#c7d2fe" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
