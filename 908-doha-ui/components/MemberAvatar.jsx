export default function MemberAvatar({ member, size = 24 }) {
  if (!member) return null;
  const initial = firstGlyph(member.name);
  const fontSize = Math.max(10, Math.round(size * 0.46));
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: member.color,
        color: '#FFFFFF',
        fontSize,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}
      title={member.name}
    >
      {initial}
    </span>
  );
}

function firstGlyph(name) {
  if (!name) return '?';
  // Use the first character (handles Korean, Latin, etc.)
  const chars = Array.from(name.trim());
  return chars[0]?.toUpperCase() ?? '?';
}
