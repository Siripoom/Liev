import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { RedeemPage } from './pages/RedeemPage';
import { WatchPage } from './pages/WatchPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<RedeemPage />} />
      <Route path="/watch/:eventId" element={<WatchPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
