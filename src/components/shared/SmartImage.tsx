'use client';

import NextImage from 'next/image';
import { useState } from 'react';

/**
 * Drop-in replacement for `<img>` that uses `next/image` for optimization
 * when the src is a remote HTTP(S) URL, and falls back to a plain `<img>`
 * for data: URLs, blob: URLs, and empty/invalid srcs.
 *
 * Why not always use next/image:
 * - `next/image` does not optimize `data:` or `blob:` URLs (it throws).
 * - Note image previews in this app are often data URLs from IDB.
 * - External cover-image URLs from arbitrary domains may not be in
 *   `remotePatterns`; we attempt next/image and fall back on error.
 *
 * Props mirror `<img>` closely; `fill` mode is used when no explicit
 * width/height is given (caller must size the container).
 */

interface SmartImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  /** When true, the image fills its (relatively-positioned) container. */
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  /** Optional blurDataURL for next/image placeholder. */
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  style?: React.CSSProperties;
  onError?: () => void;
}

export default function SmartImage({
  src,
  alt,
  className,
  loading = 'lazy',
  fill = false,
  width,
  height,
  sizes,
  placeholder,
  blurDataURL,
  style,
  onError,
}: SmartImageProps) {
  const [fellBack, setFellBack] = useState(false);

  // Empty / null src → render nothing (avoids broken-image icon).
  if (!src) return null;

  // data: and blob: URLs can't go through next/image — use plain <img>.
  const isDataUrl = src.startsWith('data:') || src.startsWith('blob:');
  if (isDataUrl || fellBack) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        style={style}
        onError={onError}
      />
    );
  }

  // Remote HTTP(S) URL → try next/image, fall back to <img> on error
  // (covers domains not in remotePatterns).
  return (
    <NextImage
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      style={style}
      onError={() => { setFellBack(true); onError?.(); }}
    />
  );
}
