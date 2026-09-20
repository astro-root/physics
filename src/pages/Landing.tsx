import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { SimulationSummary } from '../lib/types';
import { TYPE_LABELS } from '../lib/types';

/**
 * The landing page. It has one job: make it obvious within a few seconds that
 * this is a place where physics actually gets computed, not an animation
 * gallery. The hero canvas therefore runs a real integration (a driven,
 * damped pendulum phase portrait) rather than a decorative loop.
 */
export function LandingPage() {
  const [featured, setFeatured] = useState<SimulationSummary[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.simulations({ sort: 'recent' })
      .then((r) => {
        setTotal(r.total);
        const picks = ['two-body-kepler', 'lorenz-attractor', 'quantum-tunneling', 'galaxy-rotation-curve', 'simple-pendulum', 'measure-g-with-a-pendulum'];
        const chosen = picks
          .map((slug) => r.items.find((s) => s.slug === slug))
          .filter(Boolean) as SimulationSummary[];
        setFeatured(chosen.length ? chosen : r.items.slice(0, 6));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow mono">
            <span className="eyebrow-dot" aria-hidden="true" />
            {total || 30} 個のシミュレーションが常時稼働中
          </p>
          <h1>
            物理は、読むより<br /><span className="accent-text">動かした</span>ほうが早い。
          </h1>
          <p className="lede">
            るーとの物理実験室へようこそ。高校物理から宇宙論まで、{total || 30} 種類の現象を
            ブラウザの中で実際に数値積分して動かせます。パラメータを動かし、グラフを見て、
            データを CSV で持ち帰るところまでが 1 ページに収まっています。
          </p>
          <div className="btn-row">
            <Link className="btn btn-primary btn-lg" to="/catalog">実験室に入る</Link>
            <Link className="btn btn-lg" to="/s/simple-pendulum">まず振り子を触ってみる</Link>
          </div>
          <p className="mono hero-note">
            登録不要・無料・インストールなし
          </p>
        </div>
        <HeroCanvas />
      </section>

      <section className="strip">
        <Stat n={String(total || 30)} k="実装済みの現象" />
        <Stat n="5" k="コンテンツの種類" />
        <Stat n="7" k="数値積分アルゴリズム" />
        <Stat n="0" k="必要なアカウント" />
      </section>

      <section className="pitch">
        <h2>ここでできること</h2>
        <div className="pitch-grid">
          <Feature
            glyph="∫"
            title="式ではなく、運動を見る"
            body="運動方程式をその場で数値積分しています。空気抵抗を入れれば射程が縮み、時間刻みを粗くすればエネルギーがずれる。式の意味が、画面の変化として返ってきます。"
          />
          <Feature
            glyph="σ"
            title="測って、フィットして、誤差を出す"
            body="実験モードでは、振り子の周期を記録して T²–L の傾きから g を求めるところまでできます。測定にはばらつきが乗るので、点を増やすと値が寄っていく感触もそのまま体験できます。"
          />
          <Feature
            glyph="Δ"
            title="保存量がいつも見えている"
            body="エネルギー・運動量・角運動量のずれを画面に出しています。数値計算が信用できるかどうかを、結果ではなく保存量で判断する練習になります。"
          />
          <Feature
            glyph="⇩"
            title="データは持ち帰れる"
            body="読み取り値も時系列も CSV / JSON で書き出せます。レポートや課題の題材として、そのまま表計算ソフトに読み込めます。"
          />
          <Feature
            glyph="+"
            title="増やすのにコードは触らない"
            body="管理画面でコードとパラメータを書いて、検証してプレビューして公開。アプリ本体のソースは一切触らずに現象を追加できます。"
          />
          <Feature
            glyph="⧉"
            title="実行は完全に隔離"
            body="シミュレーションのコードは、オリジンを持たない iframe の中の Web Worker で動きます。通信も DOM も保存領域も届きません。"
          />
        </div>
      </section>

      <section className="pitch">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
          <h2>のぞいてみる</h2>
          <Link to="/catalog">すべて見る →</Link>
        </div>
        <div className="card-grid">
          {featured.map((s) => (
            <Link className="card" key={s.slug} to={`/s/${s.slug}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                <h3>{s.title}</h3>
                <span className="pill">{TYPE_LABELS[s.type]}</span>
              </div>
              <p>{s.shortDescription}</p>
              <div className="card-meta">
                <span className="difficulty" aria-label={`難易度 ${s.difficulty} / 5`}>
                  {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= s.difficulty ? 'on' : ''} />)}
                </span>
              </div>
            </Link>
          ))}
          {featured.length === 0 && <div className="empty">カタログを読み込んでいます…</div>}
        </div>
      </section>

      <section className="pitch">
        <h2>使い方は 3 ステップ</h2>
        <ol className="steps">
          <li><strong>探す</strong>：分野・タグ・難易度・キーワードで絞り込みます。</li>
          <li><strong>動かす</strong>：パラメータを変えながら実行し、グラフと読み取り値を見ます。</li>
          <li><strong>持ち帰る</strong>：CSV / JSON で書き出して、レポートや解析に使います。</li>
        </ol>
        <div className="btn-row" style={{ marginTop: 18 }}>
          <Link className="btn btn-primary btn-lg" to="/catalog">カタログを開く</Link>
          <Link className="btn btn-lg" to="/about">仕組みを読む</Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ n, k }: { n: string; k: string }) {
  return (
    <div className="strip-item">
      <div className="mono strip-n">{n}</div>
      <div className="strip-k">{k}</div>
    </div>
  );
}

function Feature({ title, body, glyph }: { title: string; body: string; glyph: string }) {
  return (
    <div className="feature">
      <span className="feature-glyph mono" aria-hidden="true">{glyph}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

/**
 * A driven damped pendulum, integrated with RK4 and drawn as a phase portrait.
 * Same physics as the catalogue, just used as a moving header.
 */
function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t = 0;
    let y = [0.3, 0];
    const trail: [number, number][] = [];

    const deriv = (tt: number, s: number[]) => [
      s[1],
      -0.5 * s[1] - Math.sin(s[0]) + 1.15 * Math.cos(0.66 * tt),
    ];
    const rk4 = (tt: number, s: number[], dt: number) => {
      const add = (a: number[], b: number[], f: number) => a.map((v, i) => v + b[i] * f);
      const k1 = deriv(tt, s);
      const k2 = deriv(tt + dt / 2, add(s, k1, dt / 2));
      const k3 = deriv(tt + dt / 2, add(s, k2, dt / 2));
      const k4 = deriv(tt + dt, add(s, k3, dt));
      return s.map((v, i) => v + ((k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) * dt) / 6);
    };

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (!reduced) {
        for (let i = 0; i < 12; i++) { y = rk4(t, y, 0.01); t += 0.01; }
      }
      // Keep the angle inside [-pi, pi] so the portrait wraps cleanly.
      let th = y[0];
      while (th > Math.PI) th -= 2 * Math.PI;
      while (th < -Math.PI) th += 2 * Math.PI;
      trail.push([th, y[1]]);
      if (trail.length > 1800) trail.shift();

      const X = (v: number) => w / 2 + (v / Math.PI) * (w / 2 - 20);
      const Y = (v: number) => h / 2 - (v / 3) * (h / 2 - 20);

      ctx.strokeStyle = 'rgba(120,150,175,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0));
      ctx.moveTo(X(0), 0); ctx.lineTo(X(0), h);
      ctx.stroke();

      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        if (Math.abs(a[0] - b[0]) > 3) continue; // skip the wrap-around jump
        const f = i / trail.length;
        ctx.strokeStyle = `rgba(90,200,250,${(0.03 + 0.5 * f).toFixed(3)})`;
        ctx.lineWidth = 0.5 + 1.5 * f;
        ctx.beginPath();
        ctx.moveTo(X(a[0]), Y(a[1]));
        ctx.lineTo(X(b[0]), Y(b[1]));
        ctx.stroke();
      }
      const head = trail[trail.length - 1];
      ctx.fillStyle = '#ffb454';
      ctx.beginPath();
      ctx.arc(X(head[0]), Y(head[1]), 3.5, 0, 2 * Math.PI);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <figure className="hero-figure">
      <canvas ref={ref} role="img" aria-label="強制振動する減衰振り子の位相図" />
      <figcaption className="mono">
        強制振動する減衰振り子の位相図（θ–ω）・RK4 で実時間積分
      </figcaption>
    </figure>
  );
}
