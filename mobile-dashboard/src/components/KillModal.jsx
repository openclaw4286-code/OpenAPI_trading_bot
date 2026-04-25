import { useState } from 'react';
import Modal from '@ds/components/Modal.jsx';
import Button from '@ds/components/Button.jsx';

// Two-stage Kill confirmation:
//  1. Default — pauses the loop only; positions are kept.
//  2. Checkbox — also flatten all open positions at market.
// Always require an explicit tap on the danger button regardless of mode.

export default function KillModal({ open, onClose, onConfirm }) {
  const [flattenAll, setFlattenAll] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => {
        setFlattenAll(false);
        onClose?.();
      }}
      title="⛔ 봇 정지"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              onConfirm?.({ flattenAll });
              setFlattenAll(false);
            }}
          >
            정지하기
          </Button>
        </>
      }
    >
      <p className="t-body2" style={{ color: 'var(--text-secondary)' }}>
        진행 중인 시그널 평가가 멈추고, 열린 포지션은 그대로 유지됩니다. 다시
        시작하려면 홈 화면의 <b>RESUME</b> 버튼을 탭하세요.
      </p>
      <label
        className="mt-4 flex items-start gap-2.5 rounded-xl p-3"
        style={{
          background: 'var(--state-negative-soft)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={flattenAll}
          onChange={(e) => setFlattenAll(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span className="t-body2">
          열린 포지션도 모두 시장가 청산
          <br />
          <span className="t-caption" style={{ color: 'var(--state-negative)' }}>
            ⚠ 위험 — 한 번 더 확인됩니다
          </span>
        </span>
      </label>
    </Modal>
  );
}
