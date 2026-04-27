import { useNavigate } from 'react-router-dom';
import VaultEntry from '@ds/components/VaultEntry.jsx';

// Event-log row backed by 908-doha-ui's VaultEntry (square accent
// badge + title + subtitle + hover-only trailing actions). The kind
// label sits up front in the title so the badge initial reads as the
// kind letter (E for ENTRY, R for LLM REJECT, etc.). The symbol is in
// subtitle alongside the detail text. Tap navigates to the related
// position when there is one.

const KIND_LABEL = {
  ENTRY:      'ENTRY',
  EXIT:       'EXIT',
  STOP_OUT:   'STOP-OUT',
  LLM_REJECT: 'REJECT',
  CHART:      'CHART',
  UNIVERSE:   'UNIVERSE',
};

export default function EventLogRow({ event }) {
  const navigate = useNavigate();
  const label = KIND_LABEL[event.kind] ?? event.kind;
  const entry = {
    title: `${label} · ${event.symbol}`,
    username: `${event.ts}  ${event.detail}`,
  };
  return (
    <VaultEntry
      entry={entry}
      onOpen={() => {
        if (event.symbol && event.symbol !== '-') {
          navigate(`/positions/${event.symbol}`);
        }
      }}
      onCopyPassword={() => {}}
      onCopyUsername={() => {}}
    />
  );
}
