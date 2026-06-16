'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';

type BookCoverImageProps = Omit<ImageProps, 'src' | 'alt' | 'onError'> & {
  src?: string | null;
  alt?: string | null;
};

export default function BookCoverImage({ src, alt, ...props }: BookCoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return null;

  return <Image {...props} src={src} alt={alt ?? ''} onError={() => setFailed(true)} />;
}
