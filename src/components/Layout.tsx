import { NavLink, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function Layout() {
  const { user, isAdmin, signOut } = useAuth();
  return (
    <div className="app">
      <a className="skip-link" href="#main">本文へスキップ</a>
      <header className="topbar">
        <Link to="/" className="brand" style={{ color: 'inherit' }}>
          <span className="brand-mark" aria-hidden="true" />
          <span>Dynamis<span style={{ color: 'var(--muted)', fontWeight: 400 }}> — るーとの物理実験室</span></span>
        </Link>
        <nav aria-label="メインナビゲーション">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>ホーム</NavLink>
          <NavLink to="/catalog" className={({ isActive }) => (isActive ? 'active' : '')}>カタログ</NavLink>
          <NavLink to="/about" className={({ isActive }) => (isActive ? 'active' : '')}>この場所について</NavLink>
          {isAdmin && <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>管理</NavLink>}
          {user ? (
            <>
              <span className="mono" style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{user.email}</span>
              <button className="btn btn-sm" onClick={() => signOut()}>サインアウト</button>
            </>
          ) : (
            <NavLink to="/login" className={({ isActive }) => (isActive ? 'active' : '')}>サインイン</NavLink>
          )}
        </nav>
      </header>
      <main id="main" className="page">
        <Outlet />
      </main>
      <footer className="footer">
        Dynamis — るーとの物理実験室。物理現象を検索して、ブラウザで走らせ、データを持ち帰る場所。
        数値計算はすべて分離されたサンドボックスで実行されます。
      </footer>
    </div>
  );
}
