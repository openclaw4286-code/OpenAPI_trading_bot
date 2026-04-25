import { Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import Home from './screens/Home.jsx';
import Positions from './screens/Positions.jsx';
import PositionDetail from './screens/PositionDetail.jsx';
import Signals from './screens/Signals.jsx';
import Backtest from './screens/Backtest.jsx';
import Settings from './screens/Settings.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/positions" element={<Positions />} />
        <Route path="/positions/:symbol" element={<PositionDetail />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
