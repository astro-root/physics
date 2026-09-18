import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // In the static (free) deployment there is no server to authenticate
  // against: unlocking the editor only affects this browser, and anything
  // created here stays local until it is exported and committed.
  if (api.mode === 'static') {
    return (
      <div className="page-narrow" style={{ margin: '0 auto', maxWidth: 460 }}>
        <h1>編集モードを開く</h1>
        <div className="local-banner">
          この構成にはサーバーもアカウントもありません。合言葉はこのブラウザで編集画面を開くためだけのもので、
          サイトの内容を守るものではありません。作ったものはこのブラウザの中にだけ残り、
          書き出して リポジトリに取り込むまで公開されません。
        </div>
        <form className="panel" onSubmit={submit}>
          <div className="panel-body">
            <label className="field">
              <span className="label">合言葉</span>
              <input
                type="password" required autoComplete="off"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              <div className="hint">既定値は dynamis（.env の VITE_ADMIN_PASSPHRASE で変更）</div>
            </label>
            {error && <div className="notice error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? '確認中…' : '編集モードに入る'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page-narrow" style={{ margin: '0 auto', maxWidth: 420 }}>
      <h1>{mode === 'signin' ? 'サインイン' : 'アカウントを作る'}</h1>
      <p style={{ color: 'var(--ink-dim)' }}>
        カタログの閲覧とシミュレーションの実行に登録は要りません。サインインが必要なのは管理機能だけです。
      </p>
      <form className="panel" onSubmit={submit}>
        <div className="panel-body">
          <label className="field">
            <span className="label">メールアドレス</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">パスワード</span>
            <input
              type="password" required minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <div className="hint">8 文字以上</div>
          </label>
          {error && <div className="notice error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? '送信中…' : mode === 'signin' ? 'サインイン' : '登録する'}
            </button>
            <button className="btn" type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
              {mode === 'signin' ? 'アカウントを作る' : 'サインインに戻る'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
