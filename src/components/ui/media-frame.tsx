import { cn, initialsOf, stableIndex } from '@/lib/utils';

const GRADIENTS = [
  'from-[#1a1206] via-[#2b1d07] to-[#0a0a0e]',
  'from-[#0d1420] via-[#101a2b] to-[#07070a]',
  'from-[#1d0d12] via-[#2a1118] to-[#0a0a0e]',
  'from-[#101a12] via-[#12241a] to-[#07070a]',
  'from-[#171021] via-[#22162f] to-[#0a0a0e]',
  'from-[#201607] via-[#2e1f09] to-[#07070a]',
];

export interface MediaFrameProps {
  src?: string | null;
  alt: string;
  /** Used to pick a stable fallback gradient and initials. */
  seed?: string;
  ratio?: 'square' | 'poster' | 'video' | 'wide' | 'portrait' | 'hero' | 'auto';
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  overlay?: boolean;
  children?: React.ReactNode;
}

const RATIOS: Record<NonNullable<MediaFrameProps['ratio']>, string> = {
  square: 'aspect-square',
  poster: 'aspect-[2/3]',
  video: 'aspect-video',
  wide: 'aspect-[21/9]',
  portrait: 'aspect-[3/4]',
  hero: 'aspect-[4/5] sm:aspect-[16/9]',
  auto: '',
};

/**
 * Single media surface used across the network. When artwork has not been
 * uploaded yet it renders a branded gradient plate instead of a broken image,
 * so the product looks finished before real content lands.
 */
export function MediaFrame({
  src,
  alt,
  seed,
  ratio = 'square',
  className,
  imgClassName,
  priority = false,
  overlay = false,
  children,
}: MediaFrameProps) {
  const key = seed || alt || 'boosie';
  const gradient = GRADIENTS[stableIndex(key, GRADIENTS.length)];

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden bg-ink-800 grain',
        RATIOS[ratio],
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={cn('h-full w-full object-cover', imgClassName)}
        />
      ) : (
        <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', gradient)}>
          <span
            aria-hidden
            className="font-display text-4xl uppercase tracking-tight text-gold-500/25 sm:text-5xl"
          >
            {initialsOf(key) || 'BN'}
          </span>
          <span className="sr-only">{alt}</span>
        </div>
      )}
      {overlay ? (
        <div className="pointer-events-none absolute inset-0 bg-ink-fade" aria-hidden />
      ) : null}
      {children}
    </div>
  );
}
