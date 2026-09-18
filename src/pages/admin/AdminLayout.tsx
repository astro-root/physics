import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';

const LINKS = [
  { to: '/admin', end: true, label: 'ダッシュボード' },
  { to: '/admin/simulations', label: 'シミュレーション' },
  { to: '/admin/tags', label: 'タグ' },
  { to: '/admin/categories', label: 'カテゴリ' },
  { to: '/admin/users', label: 'ユーザー' },
];

export function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="empty">確認しています…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!isAdmin) {
    return (
      <div className="empty">
        <h1>権限がありません</h1>
        <p>この画面は管理者アカウントでのみ開けます。</p>
      </div>
    );
  }

  return (
    <div className="admin">
      <nav className="admin-nav" aria-label="管理メニュー">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ minWidth: 0 }}>
        <Outlet />
      </div>
    </div>
  );
}
