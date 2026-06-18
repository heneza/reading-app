import { ImageResponse } from 'next/og';

// iOS home-screen icon (must be a raster image — iOS ignores SVG here).
// Generated from shapes so no binary asset or font is needed.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#7f1429',
        }}
      >
        <div
          style={{
            width: 96,
            height: 120,
            borderRadius: 12,
            background: '#f6eee5',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 8, background: '#7f1429' }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
