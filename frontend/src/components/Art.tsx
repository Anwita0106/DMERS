import { useState } from 'react';
import type { Guide } from '../lib/guides';
import { PHOTOS, localSrc, remoteSrc } from '../lib/photos';

/**
 * Photo with a fallback chain: local file (/images/<key>.jpg) -> same photo from Wikimedia ->
 * nothing (the illustrated background underneath stays visible). Fades in when loaded.
 */
export function PhotoImg({ photoKey, className = '', width = 1000, eager = false }: { photoKey: string; className?: string; width?: number; eager?: boolean }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [loaded, setLoaded] = useState(false);
  if (stage === 2 || !PHOTOS[photoKey]) return null;
  const src = stage === 0 ? localSrc(photoKey) : remoteSrc(photoKey, width);
  return (
    <img key={src} src={src} alt={PHOTOS[photoKey].caption} loading={eager ? 'eager' : 'lazy'} decoding="async"
      onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setStage((s) => (s + 1) as 0 | 1 | 2); }}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`} />
  );
}

/** Header image for a disaster type: real photograph over an illustrated fallback. */
export function DisasterArt({ guide, className = '' }: { guide: Guide; className?: string }) {
  const Icon = guide.icon;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${guide.from}, ${guide.to})` }}>
      <Icon className="absolute -right-4 -top-4 h-36 w-36 text-white/10" strokeWidth={1.2} />
      <PhotoImg photoKey={guide.key} className="transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
    </div>
  );
}

/** Hero backdrop: rescue photograph with a dark green gradient for readable text. */
export function HeroArt() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(34,197,94,.25),transparent_55%),linear-gradient(180deg,#06120c,#0a1a12_45%,#050a07)]" />
      <PhotoImg photoKey="hero" width={1920} eager className="object-[60%_35%]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#030806] via-[#030806]/80 to-[#030806]/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#030806] via-transparent to-[#030806]/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_60%,rgba(34,197,94,.18),transparent_50%)]" />
    </div>
  );
}
