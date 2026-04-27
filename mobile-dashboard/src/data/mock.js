// Mock snapshot of the kis_ict_trader runtime state.
// Shape mirrors loop_state.json / positions.json / signal_quality.json so a
// real read-only API layer can drop in later without changing the UI.

export const MOCK_BOT_STATUS = {
  state: 'RUNNING',          // RUNNING | PAUSED | ERROR | STOPPED
  env: 'vps',                // vps | real
  testMode: true,
  lastTickTs: Date.now() - 12_000,
  sessionOpen: '09:00',
  sessionClose: '15:30',
  entryCutoff: '15:20',
};

export const MOCK_PNL = {
  realizedKrw: 342_100,
  realizedPct: 0.0034,
  unrealizedKrw: 88_400,
  exposurePct: 0.124,
  startEquityKrw: 100_000_000,
};

export const MOCK_POSITIONS = [
  {
    symbol: '005930',
    name: '삼성전자',
    direction: 'bull',
    entry: 70_500,
    currentPrice: 70_920,
    stop: 70_500,
    initialQty: 200,
    remainingQty: 100,
    targets: [71_200, 72_400, 73_600],
    tp1Done: true,
    tp2Done: false,
    tp3Done: false,
    rMultiple: 1.2,
    poiKind: 'FVG',
    triggerKind: 'BOS',
    session: 'asia',
    enteredAt: '09:01',
    llmConfidence: 0.78,
    llmRationale: 'HTF/MTF bull 정렬, FVG POI 미체결, 뉴스 리스크 없음',
    fills: [
      { ts: '09:01', side: 'BUY', qty: 100, price: 70_500, kind: '지정가' },
      { ts: '09:04', side: 'BUY', qty: 100, price: 70_500, kind: '지정가' },
      { ts: '09:38', side: 'SELL', qty: 100, price: 71_200, kind: 'TP1' },
    ],
  },
  {
    symbol: '000660',
    name: 'SK하이닉스',
    direction: 'bull',
    entry: 132_000,
    currentPrice: 131_400,
    stop: 130_500,
    initialQty: 50,
    remainingQty: 50,
    targets: [133_500, 135_000, 137_000],
    tp1Done: false,
    tp2Done: false,
    tp3Done: false,
    rMultiple: -0.4,
    poiKind: 'OB',
    triggerKind: 'CHoCH',
    session: 'asia',
    enteredAt: '09:02',
    llmConfidence: 0.62,
    llmRationale: 'OB 미체결, 단기 디센딩 트라이앵글 브레이크',
    fills: [
      { ts: '09:02', side: 'BUY', qty: 50, price: 132_000, kind: '지정가' },
    ],
  },
  {
    symbol: '035420',
    name: 'NAVER',
    direction: 'bull',
    entry: 218_000,
    currentPrice: 219_500,
    stop: 215_500,
    initialQty: 30,
    remainingQty: 30,
    targets: [220_500, 223_000, 226_000],
    tp1Done: false,
    tp2Done: false,
    tp3Done: false,
    rMultiple: 0.6,
    poiKind: 'FVG',
    triggerKind: 'BOS',
    session: 'pm',
    enteredAt: '13:18',
    llmConfidence: 0.55,
    llmRationale: 'PM 세션 진입, FVG 50% 미충족, 거래량 평균 이상',
    fills: [
      { ts: '13:18', side: 'BUY', qty: 30, price: 218_000, kind: '지정가' },
    ],
  },
];

export const MOCK_RECENT_EVENTS = [
  { ts: '09:38', kind: 'ENTRY', symbol: '005930', detail: '@70,500 (200주)' },
  { ts: '09:21', kind: 'LLM_REJECT', symbol: '035420', detail: 'rr 1.2 < 1.5 floor' },
  { ts: '09:15', kind: 'CHART', symbol: '012450', detail: 'daily.png 렌더' },
  { ts: '09:02', kind: 'ENTRY', symbol: '000660', detail: '@132,000 (50주)' },
  { ts: '08:00', kind: 'UNIVERSE', symbol: '-', detail: 'top-N 20 종목 빌드' },
];

export const MOCK_PIPELINE = {
  universe: 20,
  ictPass: 7,
  llmApproved: 3,
  submitted: 3,
};

export const MOCK_SIGNALS = [
  {
    ts: '13:18',
    symbol: '035420',
    name: 'NAVER',
    outcome: 'approved',
    rr: 2.1,
    poiKind: 'FVG',
    triggerKind: 'BOS',
    session: 'pm',
    llmConf: 0.55,
    rationale: 'PM 세션 진입, 거래량 평균 이상',
  },
  {
    ts: '09:38',
    symbol: '005930',
    name: '삼성전자',
    outcome: 'approved',
    rr: 2.3,
    poiKind: 'FVG',
    triggerKind: 'BOS',
    session: 'asia',
    llmConf: 0.78,
    rationale: 'HTF/MTF bull 정렬, FVG POI 미체결, 뉴스 리스크 없음',
  },
  {
    ts: '09:21',
    symbol: '035420',
    name: 'NAVER',
    outcome: 'rejected',
    rr: 1.2,
    poiKind: 'OB',
    triggerKind: 'BOS',
    session: 'asia',
    llmConf: 0.2,
    rationale: 'rr below 1.5 floor',
  },
  {
    ts: '09:15',
    symbol: '012450',
    name: '한화에어로스페이스',
    outcome: 'wait',
    rr: 0,
    poiKind: null,
    triggerKind: '-',
    session: 'asia',
    llmConf: 0,
    rationale: 'LTF 트리거 미발생 (wait streak 2/3)',
  },
  {
    ts: '09:02',
    symbol: '000660',
    name: 'SK하이닉스',
    outcome: 'approved',
    rr: 1.9,
    poiKind: 'OB',
    triggerKind: 'CHoCH',
    session: 'asia',
    llmConf: 0.62,
    rationale: 'OB 미체결, 단기 디센딩 트라이앵글 브레이크',
  },
];

export const MOCK_BACKTEST = {
  runAt: '2026-04-23 14:02',
  portfolio: {
    nTrades: 42,
    winRate: 0.55,
    avgR: 0.38,
    totalReturn: 0.12,
    maxDrawdown: -0.08,
    llmRejected: 15,
    skippedNoRoom: 7,
  },
  perSymbol: [
    { symbol: '005930', name: '삼성전자', trades: 12, winRate: 0.58, avgR: 0.42 },
    { symbol: '000660', name: 'SK하이닉스', trades: 8,  winRate: 0.50, avgR: 0.18 },
    { symbol: '035420', name: 'NAVER',     trades: 6,  winRate: 0.33, avgR: -0.21 },
  ],
};

export const MOCK_SETTINGS = {
  kisEnv: 'vps',
  testMode: true,
  allowShort: false,
  mtfMode: 'daily',
  qualityFilter: false,
  topN: 20,
  notifyChannels: {
    entry: true,
    reject: true,
    stopOut: true,
    tickSummary: false,
  },
  webhook: { provider: 'slack', connected: true },
};
