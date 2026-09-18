import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';
import { LandingPage } from './pages/Landing';
import { SimulationPage } from './pages/SimulationPage';
import { LoginPage } from './pages/Login';
import { AboutPage } from './pages/About';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminSimulationList } from './pages/admin/SimulationList';
import { AdminSimulationEditor } from './pages/admin/SimulationEditor';
import { AdminTags, AdminCategories, AdminUsers } from './pages/admin/Taxonomy';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="catalog" element={<HomePage />} />
            <Route path="s/:slug" element={<SimulationPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="simulations" element={<AdminSimulationList />} />
              <Route path="simulations/:id" element={<AdminSimulationEditor />} />
              <Route path="tags" element={<AdminTags />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="users" element={<AdminUsers />} />
            </Route>
            <Route path="*" element={<div className="empty"><h1>見つかりません</h1><p>アドレスを確認してください。</p></div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
