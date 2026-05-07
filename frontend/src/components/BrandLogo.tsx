'use client';
import { useState } from 'react';

type Props = {
  size?: number;
  showText?: boolean;
  textPosition?: 'right' | 'below';
};

/**
 * BrandLogo — 619 FITNESS STUDIO mark.
 * Falls back to a gradient "619" tile if logo file not found.
 */
export default function BrandLogo({
  size = 40,
  showText = false,
  textPosition = 'right',
}: Props) {
  const candidates = [
    '/logo.PNG',
    '/logo.png',
    '/logo.jpg',
    '/logo.jpeg',
    '/logo.svg',
    '/logo.webp',
  ];
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  const onError = () => {
    if (idx < candidates.length - 1) setIdx(idx + 1);
    else setFailed(true);
  };

  const radius = Math.round(size * 0.22);

  const Mark = failed ? (
    <div
      aria-label="619 FITNESS STUDIO"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, var(--brand-hi) 0%, var(--brand-lo) 100%)',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: Math.round(size * 0.34),
        letterSpacing: '-0.02em',
        boxShadow:
          '0 6px 20px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.40)',
        flexShrink: 0,
        fontFeatureSettings: '"tnum"',
      }}
    >
      619
    </div>
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        padding: Math.round(size * 0.10),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        border: '2px solid rgba(225, 29, 72, 0.35)',
        boxShadow:
          '0 0 16px rgba(225, 29, 72, 0.30), 0 2px 8px rgba(15,23,42,0.15)',
        flexShrink: 0,
      }}
    >
      <img
        src={candidates[idx]}
        alt="619 FITNESS STUDIO"
        onError={onError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  );

  if (!showText) return Mark;

  const isBelow = textPosition === 'below';
  const textBlock = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isBelow ? 'center' : 'flex-start',
        lineHeight: 1,
      }}
    >
      <div className="brand-619-name">
        619 FITNESS STUDIO
      </div>
      <div className="brand-619-tag">
        Premium Strength Studio
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isBelow ? 'column' : 'row',
        alignItems: 'center',
        gap: isBelow ? '0.85rem' : '0.6rem',
      }}
    >
      {Mark}
      {textBlock}
    </div>
  );
}
