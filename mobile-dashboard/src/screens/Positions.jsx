import { useMemo, useState } from 'react';
import ScreenHeader from '../components/ScreenHeader.jsx';
import PositionMiniCard from '../components/PositionMiniCard.jsx';
import SearchField from '@ds/components/SearchField.jsx';
import EmptyScaffold from '@ds/components/EmptyScaffold.jsx';
import { MOCK_POSITIONS } from '../data/mock.js';

// Read-only positions list. Search filters by symbol code OR Korean
// name (case-insensitive on the symbol). Direction filter pills are
// intentionally omitted — for an open-positions view a single search
// stays out of the way.

export default function Positions() {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return MOCK_POSITIONS;
    return MOCK_POSITIONS.filter(
      (p) =>
        p.symbol.toLowerCase().includes(t) || p.name.toLowerCase().includes(t),
    );
  }, [q]);

  return (
    <>
      <ScreenHeader title="포지션" />
      <div className="flex flex-col gap-3 p-4 pb-8">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="종목코드 또는 이름"
          className="w-full"
        />
        {filtered.length === 0 ? (
          <EmptyScaffold
            title="해당 포지션이 없어요"
            subtitle={q ? '다른 검색어를 입력해보세요.' : '진입 시 자동으로 추가됩니다.'}
            spec={q ? `q="${q}"` : 'positions.json'}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((p) => (
              <PositionMiniCard key={p.symbol} position={p} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
