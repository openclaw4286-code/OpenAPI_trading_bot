// Shimmer placeholder. Matches docs/skeleton.html — linear gradient
// that slides across via a 1.4s keyframe. Reach for it whenever the
// eventual layout is known so a viewer's eye doesn't bounce when
// real content swaps in.

export default function Skeleton({
  width,
  height,
  className = '',
  style,
  rounded = 6,
  circle = false,
}) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width,
        height,
        borderRadius: circle ? '999px' : rounded,
        background:
          'linear-gradient(90deg, var(--surface-layered) 0%, var(--surface-sunken) 50%, var(--surface-layered) 100%)',
        backgroundSize: '200% 100%',
        animation: 'dsSkeleton 1.4s linear infinite',
        ...style,
      }}
    />
  );
}
