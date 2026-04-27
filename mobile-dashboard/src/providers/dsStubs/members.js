// Stub for 908-doha-ui's lib/members.js. Surfaces three "synthetic"
// members so design-system components that consult AuthContext.members
// (TaskCard avatar stack, NoteCard author avatar) have something
// meaningful to render in the trading-bot context:
//   BOT — the kis_ict_trader scheduler / loop
//   LLM — the Claude CLI gate
//   KIS — the broker order surface
// Hex colors come straight from the design-system palette so the
// avatars sit on the same scale as native member avatars elsewhere.

export const MEMBER_COLORS = [
  '#0064FF', '#1E8443', '#D23826', '#B5610F',
  '#95790A', '#0A6E6E', '#4F3478',
];

const SYNTHETIC = [
  { id: 'bot', name: 'BOT', color: '#0064FF', role: 'scheduler', hasPassword: false },
  { id: 'llm', name: 'LLM', color: '#0A6E6E', role: 'risk-gate', hasPassword: false },
  { id: 'kis', name: 'KIS', color: '#B5610F', role: 'broker',    hasPassword: false },
];

export async function listMembers() { return SYNTHETIC.slice(); }
export async function getMember(id)   { return SYNTHETIC.find((m) => m.id === id) ?? null; }
export async function createMember()  { return null; }
export async function updateMember()  { return null; }
export async function deleteMember()  { return null; }
