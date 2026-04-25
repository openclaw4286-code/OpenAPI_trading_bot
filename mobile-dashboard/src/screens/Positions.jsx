import ScreenHeader from '../components/ScreenHeader.jsx';
import PositionMiniCard from '../components/PositionMiniCard.jsx';
import EmptyScaffold from '@ds/components/EmptyScaffold.jsx';
import { MOCK_POSITIONS } from '../data/mock.js';

export default function Positions() {
  const items = MOCK_POSITIONS;
  return (
    <>
      <ScreenHeader title="포지션" />
      <div className="flex flex-col gap-2 p-4 pb-8">
        {items.length === 0 ? (
          <EmptyScaffold
            title="열린 포지션이 없어요"
            subtitle="진입 시 자동으로 카드가 추가됩니다."
            spec="positions.json"
          />
        ) : (
          items.map((p) => <PositionMiniCard key={p.symbol} position={p} />)
        )}
      </div>
    </>
  );
}
