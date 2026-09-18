# Dynamis — るーとの物理実験室

物理現象を検索して、ブラウザ上で実際に数値計算し、データを持ち帰れる仮想実験室です。
高校物理から大学の力学・電磁気・量子・相対論、天体物理・宇宙論までを同じ枠組みで扱います。

**完全無料で公開できます。** 既定の構成（static モード）はデータベースもサーバーも使いません。
カタログはビルド時に 1 つの JSON にまとめられ、出来上がるのは静的ファイルだけです。
Vercel の無料枠にそのまま乗り、課金対象になる要素（サーバーレス関数の実行、DB、ストレージ）が 1 つもありません。

新しいシミュレーションを追加するときに、**アプリ本体のソースコードを触る必要はありません。**

---

## 目次

1. [できること](#1-できること)
2. [2 つの動作モード](#2-2-つの動作モード)
3. [Vercel に無料で公開する](#3-vercel-に無料で公開する)
4. [ローカル開発](#4-ローカル開発)
5. [アーキテクチャ](#5-アーキテクチャ)
6. [技術選定の理由](#6-技術選定の理由)
7. [ディレクトリ構成](#7-ディレクトリ構成)
8. [コンテンツの追加（static モード）](#8-コンテンツの追加static-モード)
9. [Simulation コード仕様](#9-simulation-コード仕様)
10. [Experiment の作り方](#10-experiment-の作り方)
11. [サーバーモード（任意）](#11-サーバーモード任意)
12. [セキュリティ](#12-セキュリティ)
13. [テスト](#13-テスト)
14. [トラブルシューティング](#14-トラブルシューティング)
15. [同梱コンテンツ 30 件](#15-同梱コンテンツ-30-件)
16. [既知の制約と今後](#16-既知の制約と今後)

---

## 1. できること

**ランディングページ**
強制振動する減衰振り子の位相図を RK4 で実時間積分しながら描くヒーロー、サイトの狙い、注目コンテンツ、使い方の 3 ステップ。
飾りのアニメーションではなく、カタログと同じ物理を動かしています。

**カタログと検索**
キーワード／カテゴリ（階層）／タグ（AND・OR 切り替え）／タイプ／難易度／対象レベルで絞り込み。
並び順は更新順・名前順・やさしい順・追加順。URL にそのまま反映されるので、絞り込んだ状態を共有できます。

**5 種類のコンテンツ**
`simulation`（時間発展）／`experiment`（測定と解析）／`visualization`（場や分布）／`model`（単純化モデル）／`calculator`（値を入れて計算）。

**実行環境**
パラメータのスライダー・数値入力・選択・スイッチ、実行／一時停止／ステップ／リセット／速度調整、
計器風の読み取り値、シミュレーションごとに定義したグラフ（x–t、v–t、エネルギー、位相空間、軌道、分布…）、CSV / JSON 書き出し。

**実験モード**
目的・条件・手順・測定表・解析・理論値との比較。測定値を記録して最小二乗フィットし、実験値・不確かさ・相対誤差を出します。

**管理画面**
ダッシュボード、一覧（検索・複製・並び替え・公開／非公開／アーカイブ・削除）、Monaco によるコード編集、
保存前の検証、公開せずに動かせるプレビュー、バージョン履歴と復元、タグ／カテゴリ管理。

---

## 2. 2 つの動作モード

| | **static（既定・無料）** | **server（任意）** |
| --- | --- | --- |
| データの置き場所 | ビルドに焼き込まれた JSON | SQLite |
| 検索 | ブラウザ内で実行 | SQLite FTS5 |
| 公開に必要なもの | 静的ホスティングだけ | Node.js が動くサーバー |
| 管理画面の編集 | そのブラウザの中に保存され、書き出して取り込む | その場で全員に反映 |
| 認証 | なし（守るべきサーバーがない） | JWT + bcrypt、権限は毎回 DB 照合 |
| 費用 | 0 円 | ホスティング費用 |

切り替えは環境変数 1 つです。

```bash
VITE_DATA_MODE=static   # 既定
VITE_DATA_MODE=server   # server/ の Express + SQLite を使う
```

同じ `api` インターフェースの裏側が差し替わるだけなので、画面側のコードは両モードで共通です。

> **static モードの編集について正直に**
> サーバーがないので、管理画面で作ったものは**そのブラウザの localStorage にだけ**残ります。
> 公開するには、ダッシュボードから JSON を書き出し、リポジトリに取り込んで再デプロイします。
> ログインの合言葉は編集画面を開くための鍵で、サイトを守るものではありません（守る対象のサーバーがないため）。
> 「一人〜少人数で作って、Git で公開する」使い方に合わせた設計です。

---

## 3. Vercel に無料で公開する

必要なのは GitHub アカウントと Vercel アカウント（どちらも無料）だけです。

1. このプロジェクトを GitHub のリポジトリに push します。
2. Vercel で **Add New → Project** からそのリポジトリを選びます。
3. 設定は `vercel.json` に入っているので、そのまま **Deploy** を押すだけです。
   - Framework: Vite（自動検出）
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. 数十秒でデプロイが終わり、`https://<プロジェクト名>.vercel.app` で公開されます。

環境変数は設定しなくても動きます。変えたい場合のみ Vercel の Settings → Environment Variables に：

| 変数 | 既定 | 説明 |
| --- | --- | --- |
| `VITE_DATA_MODE` | `static` | `server` にするとバックエンドを見に行きます |
| `VITE_ADMIN_PASSPHRASE` | `dynamis` | 編集画面を開く合言葉（このブラウザ内だけの鍵） |

`vercel.json` では SPA のルーティング用に全パスを `index.html` に書き戻し、
`/assets/` に長期キャッシュ、全体に `X-Content-Type-Options` などのヘッダーを付けています。

**Cloudflare Pages / GitHub Pages / Netlify でも同じです。**
ビルドコマンド `npm run build`、出力ディレクトリ `dist`、SPA フォールバックを `index.html` に設定してください。
GitHub Pages のようにサブパスで配信する場合は `vite.config.ts` に `base: '/リポジトリ名/'` を足します。

---

## 4. ローカル開発

必要なもの：Node.js 20 以上。

```bash
npm install          # サーバー用の依存はオプション扱いなので失敗しても静的モードは動きます
npm run dev          # http://localhost:5173
```

`npm run dev` は先に `npm run content`（seed → JSON 変換）を走らせてから Vite を起動します。
`server/seed/` を編集したら、`npm run content` を実行し直すか dev を再起動してください。

```bash
npm run build        # content 生成 → 型チェック → vite build（出力は dist/）
npm run preview      # ビルド結果をローカルで確認
npm test             # 物理・シミュレーション・（あれば）API のテスト
npm run typecheck
```

---

## 5. アーキテクチャ

```
ブラウザ
├── React SPA（LP / カタログ / 実行画面 / 管理画面）
│   ├── src/content/catalogue.json     ← ビルド時に seed から生成（static モード）
│   └── <iframe sandbox="allow-scripts">   ← オリジンなし、CSP default-src 'none'
│         ├── 描画コード（Canvas 2D）
│         └── Web Worker
│               └── シミュレーションコード + PL（数値計算ライブラリ）
│
└── （server モードのときだけ）fetch /api/*
        └── Express + SQLite（FTS5・JWT・バージョン管理）
```

考え方はひとつだけです。**シミュレーションはアプリのコードではなくコンテンツである。**
だから追加に再デプロイの手作業（ソース改変）が要らず、だからこそ本体と同じ実行文脈では走らせません。

---

## 6. 技術選定の理由

| 採用 | 理由 |
| --- | --- |
| **TypeScript + React 18 + Vite** | 状態の多い管理 UI に型が効く。Vite は起動が速く、`?raw` でサンドボックス用のソース埋め込みが素直に書ける |
| **静的 JSON バンドル（既定）** | 無料で公開できることが要件なので、DB もサーバーレス関数も使わない構成を既定にした。30 件・214 kB（gzip 約 50 kB）は一括読み込みで十分速く、検索も全件走査で体感即時 |
| **Express + better-sqlite3（任意）** | 複数人で同じカタログを編集したくなったとき用。外部サービス不要で `npm install` だけで完結し、FTS5 が標準で使える |
| **Canvas 2D（自前の描画ヘルパー）** | 可視化の中身がシミュレーションごとに違いすぎる。汎用チャートライブラリより素の Canvas の方が軽く、毎フレーム再描画に向く |
| **Monaco Editor** | コード編集に必要な最低限を満たす。読み込みに失敗しても textarea に自動で落ちる |
| **Vitest + Supertest** | 物理計算テストと API テストを同じコマンドで回せる |

**採用しなかったもの**

- **Three.js**：3 次元表示が必要なのは 2 件だけで、いずれも軌跡の描画です。数十行の正射影ヘルパー（`helpers.project3D`）で足りるため、サンドボックスに数百 KB を持ち込む取引は見合いませんでした。面や光源が要るようになったら、CSP に `script-src 'self'` を足して同一オリジンから読み込めます。
- **Python / WebAssembly**：1 フレームあたり数万回程度の四則演算で、JavaScript の JIT で 60 fps に収まります。Pyodide は初回 10 MB 超のダウンロードを伴い、リアルタイム性でも不利です。格子ボルツマン法や大規模 N 体のように計算量が桁で増えるものを載せる段階で、その Simulation だけ WASM を読む形が適切です。
- **Supabase / Firebase / Vercel Postgres**：どれも無料枠はありますが、アカウント登録・接続情報の管理・無料枠の上限という運用が増えます。「展開して push すれば公開される」という要件に対して割に合いません。
- **Next.js**：サーバーサイドレンダリングの利点がない（中身は全部インタラクティブな計算）ため、Vite の静的ビルドで十分です。

---

## 7. ディレクトリ構成

```
dynamis/
├── README.md / vercel.json / .env.example
├── package.json          # server 系は optionalDependencies
├── vite.config.ts / vitest.config.ts / tsconfig.json
├── index.html            # タイトル・OGP・favicon
├── public/favicon.svg
├── scripts/
│   └── build-content.mjs # server/seed → src/content/catalogue.json
├── src/
│   ├── main.tsx / App.tsx / index.css
│   ├── content/          # 生成物（gitignore 済み）
│   ├── lib/
│   │   ├── api.ts        # static / server を切り替える窓口
│   │   ├── store.ts      # 静的カタログ + ブラウザ内オーバーレイ
│   │   ├── physics-core.js  # 依存なしの数値計算ライブラリ（PL）
│   │   ├── auth.tsx / types.ts / format.ts
│   ├── sandbox/          # sandbox-doc.ts（srcdoc 組み立て）, useSimulationRuntime.ts
│   ├── components/       # SimulationWorkbench, Chart, ExperimentPanel, CodeEditor, Layout
│   └── pages/            # Landing, Home(カタログ), SimulationPage, About, Login, admin/*
├── server/               # 任意のバックエンド
│   ├── app.js / db.js / schema.sql / auth.js / validate.js / routes/ / scripts/
│   └── seed/             # 同梱コンテンツの定義（static モードの元データでもある）
└── tests/
    ├── physics.test.ts       # 積分法 vs 解析解
    ├── simulations.test.ts   # 同梱 30 件の実行と物理チェック
    └── api.test.ts           # server モードの認証・権限・CRUD（未インストールなら自動 skip）
```

---

## 8. コンテンツの追加（static モード）

**方法 A：管理画面で作ってから取り込む（試行錯誤向き）**

1. `/login` で合言葉（既定 `dynamis`）を入れて編集モードに入る
2. 管理 › シミュレーション › 新規作成
3. コード・パラメータ・グラフを書き、**検証** → **プレビュー**で動かす
4. 保存（このブラウザの中に入ります）
5. ダッシュボードの「このブラウザの編集内容」から **JSON で書き出す**
6. 書き出した内容を `server/seed/` のファイルに足して `npm run content` → commit → push

**方法 B：seed ファイルに直接書く（確定したもの向き）**

`server/seed/mechanics.js` などに `sim({ ... })` を 1 つ足して `npm run content`。
分野ごとにファイルが分かれているので、追加場所は素直に決まります。

どちらでも、公開されるのは **リポジトリに入ったもの** だけです。ブラウザに残った編集は他の人には見えません。

---

## 9. Simulation コード仕様

### 9.1 `simulationCode`（Worker 内で実行）

関数の本体として評価され、`PL` だけを受け取ります。次の形のオブジェクトを **return** してください。

```js
return {
  meta: { integrator: 'RK4' },            // 任意。記録用

  init(params) {                          // 初期状態を返す
    return { y: [0, params.v0] };
  },

  step(state, dt, params, t) {            // dt だけ進める
    state.y = PL.rk4((tt, y) => [y[1], -params.g], 0, state.y, dt);
    return state;
  },

  sample(state, params, t) {              // 描画・読み取り・グラフ用のデータ
    const scalars = { t, x: state.y[0], v: state.y[1] };
    return {
      draw: { x: state.y[0] },            // rendererCode に渡る
      scalars,                            // displayDefinitions が参照する
      series: scalars,                    // graphDefinitions が参照する
      done: false,                        // true を返すと自動停止
    };
  },

  onParams(state, params) {},             // 任意。定義すると再起動せずに反映する
};
```

`PL` で使えるもの：

- 定数：`PL.constants`（`g, G, c, e, me, mp, kB, h, hbar, eps0, mu0, ke, NA, R, AU, Msun, Mearth, yr`。CODATA 2018）
- ベクトル：`PL.vec`（`add, sub, scale, dot, norm, dist, unit, cross, cross2`）
- 積分法：`PL.euler` / `PL.rk4` / `PL.semiImplicitEuler` / `PL.velocityVerlet` / `PL.positionVerlet` / `PL.borisPush` / `PL.rk45Step`
- 保存量：`PL.kineticEnergy` / `PL.gravitationalPotential` / `PL.totalMomentum` / `PL.angularMomentum2D` / `PL.centerOfMass` / `PL.nBodyAccelerations`
- 解析：`PL.linearFit` / `PL.histogram` / `PL.rng`（シード付きで再現可能） / `PL.relativity`

使えないもの：DOM、`fetch` などの通信、`localStorage`、`importScripts`、外部モジュール。

### 9.2 `rendererCode`（iframe のメインスレッドで実行）

`(ctx, frame, params, helpers)` を受け取る関数の本体です。`frame.draw` に `sample()` の `draw` が入ります。

| API | 説明 |
| --- | --- |
| `helpers.w`, `helpers.h` | 描画領域の CSS ピクセルサイズ |
| `helpers.view(bounds, opts)` | 物理座標 → ピクセル（`x()`, `y()`, `len()`。既定はアスペクト比保持、`stretch: true` で引き伸ばし） |
| `helpers.grid(view, dx, dy)` / `helpers.axes(view)` | 目盛りと軸 |
| `helpers.arrow(x0,y0,x1,y1,size)` / `helpers.label(text,x,y,opts)` | 矢印とラベル |
| `helpers.project3D(p, {yaw, pitch})` | 3 次元の正射影 |
| `helpers.theme` / `helpers.colorFor(i)` | 配色 |

### 9.3 定義 JSON

```jsonc
// parameterDefinitions
[{ "key": "v0", "label": "初速", "type": "range", "default": 30,
   "min": 1, "max": 120, "step": 0.5, "unit": "m/s", "restart": true }]
// type: number | range | select | boolean、restart: true は変更時に計算をやり直す

// graphDefinitions
[{ "id": "v-t", "title": "速度 v–t", "mode": "time",
   "x": { "key": "t", "label": "時間", "unit": "s" },
   "y": [{ "key": "v", "label": "v", "color": "#5ac8fa" }] }]

// displayDefinitions
[{ "key": "v", "label": "速度", "unit": "m/s", "precision": 3, "format": "auto" }]
```

### 9.4 積分法の選び方

| 系 | 推奨 | 理由 |
| --- | --- | --- |
| 保存系（振り子、ばね、重力） | `velocityVerlet` | シンプレクティック。エネルギーが振動するだけでドリフトしない |
| 減衰・駆動・回路・崩壊 | `rk4` | 4 次精度で、速度依存項を正しく扱える |
| 磁場中の荷電粒子 | `borisPush` | 純磁場で速さを厳密に保存する |
| 接近遭遇・離心率の高い軌道 | `rk45Step` | 時間刻みを自動調整 |
| 波動方程式 | 陽的差分 | クーラン条件 `c·dt/dx ≤ 1` を守ること |

同梱のものはたいていエネルギーや運動量のずれを画面に出しています。
新しく作るときも、保存するはずの量を 1 つ表示に入れておくと、時間刻みが妥当かすぐ分かります。

---

## 10. Experiment の作り方

タイプを `experiment` にして、実験タブで定義します。

```jsonc
{
  "objective": "単振り子の周期から重力加速度を求める",
  "conditions": ["振れ角は 10° 以下", "10 往復を測って 10 で割る"],
  "procedure": ["長さを設定する", "周期を記録する", "解析する"],
  "measurements": [
    { "key": "L", "label": "長さ", "unit": "m", "source": "readout", "from": "lengthNow" },
    { "key": "T", "label": "周期", "unit": "s", "source": "readout", "from": "measuredPeriod" }
  ],
  "theory": { "label": "重力加速度 g", "value": 9.80665, "unit": "m/s²" },
  "analysisCode": "const xs = input.rows.map(r => Number(r.L)); ... return { fit, points, result, xLabel, yLabel };"
}
```

`source: "readout"` の項目は「現在の値を記録」ボタンで読み取り値から自動で入ります。
`analysisCode` はシミュレーションと同じサンドボックスで実行され、`input.rows` に測定表が渡ります。
戻り値の `result` が実験値、`theory` が理論値として並び、相対誤差が自動計算されます。

---

## 11. サーバーモード（任意）

複数人で同じカタログを編集したい場合だけ使います。

```bash
cp .env.example .env
# JWT_SECRET と ADMIN_PASSWORD を書き換える
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

npm install                # optionalDependencies も入る
npm run db:reset           # DB 作成 + 管理者作成 + 30 件投入
npm run dev:server         # API(8787) + Vite(5173, VITE_DATA_MODE=server)
```

| 変数 | 既定 | 説明 |
| --- | --- | --- |
| `JWT_SECRET` | （必須） | セッション JWT の署名鍵。本番で既定値のままなら起動を拒否します |
| `PORT` | `8787` | API のポート |
| `DATABASE_FILE` | `./data/dynamis.db` | SQLite ファイル |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | 初回シードで作る管理者 |
| `CORS_ORIGIN` | `http://localhost:5173` | 許可オリジン |
| `SERVE_CLIENT` | `false` | `true` で API プロセスが `dist/` も配信 |

権限は `Guest` / `User` / `Admin`。新規登録は常に `User` で、本文に `role` を入れても無視されます。
`requireAdmin` は毎リクエストで DB から `role` を読み直すので、セッション中に降格されれば次のリクエストで 403 になります。

Vercel はこのモードには向きません（永続ファイルシステムがないため）。Fly.io、Render、Railway、あるいは VPS が適します。

---

## 12. セキュリティ

シミュレーションコードは編集者が自由に書けます。そのため**コードは常に本体の外側で実行します**。

1. **オリジンなしの iframe** — `sandbox="allow-scripts"` のみ（`allow-same-origin` は付けない）。
   オリジンが不透明になり、親 DOM・Cookie・localStorage・IndexedDB のどれにも到達できません。
2. **CSP** — iframe 内部は
   `default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src 'none'; form-action 'none'; base-uri 'none'`。
   `connect-src 'none'` で fetch / XHR / WebSocket / EventSource がすべて失敗します。持ち出し経路がありません。
3. **Web Worker** — 物理計算はさらに Worker の中。DOM も Canvas も持たず、いつでも `terminate()` できます。
4. **ウォッチドッグ** — 1 フレーム 20 ms の予算を超えたら打ち切って警告。5 秒フレームが返らなければ Worker を強制終了。
   無限ループを書いてもページは固まりません。
5. **メッセージの検証** — 親は `event.source` が自分の iframe であることを確認してから受け取ります。
6. **保存前の静的チェック** — 構文エラー、`init` / `step` の欠落、サンドボックスで動かない API を指摘します。
   これは利便性のための検査で、安全性の根拠ではありません。根拠は 1〜4 です。
7. **`eval` の扱い** — 編集者のコードを本体のコンテキストで評価することはありません。
   `new Function` を呼ぶのは隔離済みの iframe と Worker の内部だけです（保存前の構文チェックも、副作用のない構文検査として同じ関数コンストラクタを使います）。
8. **server モードの権限** — トークンには利用者 ID しか入れず、権限は毎回 DB 照合。
   フロントでボタンを隠すのは表示上の都合で、API 側が単独で拒否します。

**static モードで残るリスク**：合言葉は編集画面を開く鍵にすぎません。
公開内容はリポジトリの中身で決まるので、守るべきはリポジトリへの書き込み権限です。

---

## 13. テスト

```bash
npm test
```

- `tests/physics.test.ts` — 自由落下、終端速度、Verlet のエネルギー保存と Euler のドリフト、
  振り子の周期（小角度と大振幅補正）、ケプラー周期、N 体の運動量・角運動量、Boris 法の速さ保存、
  RC の 63.2%、半減期、弾性／完全非弾性衝突、適応 RK45、最小二乗、相対論、乱数の再現性。
  すべて**解析解との比較**で、前回の実行結果との比較ではありません。
- `tests/simulations.test.ts` — 同梱 30 件すべてを実際に走らせ、値が有限であること、
  読み取り値とグラフが参照するキーが存在することを確認。加えて射程 `v₀²sin2θ/g`、
  抵抗で射程が縮むこと、衝突の運動量保存、二体の保存量、波束のノルム、γ = 5/3 の時間の遅れなどを検証。
- `tests/api.test.ts` — server モードの認証・権限・ライフサイクル・バージョン・検索。
  バックエンドが未インストールなら自動で skip されます。

---

## 14. トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| Vercel のビルドが `better-sqlite3` で落ちる | server 系は `optionalDependencies` なので本来は無視されます。念のため Install Command を `npm install --omit=optional` にしてください |
| 直リンクで開くと 404 になる | `vercel.json` の rewrites が効いていません。他のホスティングでは SPA フォールバックを `index.html` に設定してください |
| カタログが空になる | `npm run content` を実行して `src/content/catalogue.json` を生成してください（`npm run dev` / `build` は自動で走ります） |
| 画面が真っ黒でシミュレーションが動かない | 画面上部のエラー表示を確認。`rendererCode` の例外はその場に出ます。コンソールに CSP 違反が出ていれば、コードが通信や DOM に触れています |
| 「シミュレーションが停止しました: watchdog」 | `step()` が重すぎます。`dt` を大きくするか 1 ステップの計算量を減らしてください |
| コードエディタが出ない | Monaco の読み込みに失敗すると自動で textarea に切り替わります。機能に影響はありません |
| 編集内容が消えた | static モードの編集はブラウザの localStorage です。シークレットウィンドウやサイトデータの消去で消えます。こまめに書き出してください |
| `npm install` が server 系で失敗する | 静的モードだけなら問題ありません。`npm install --omit=optional` で回避できます |

---

## 15. 同梱コンテンツ 30 件

いずれも物理モデル・数値計算・描画・パラメータ・結果表示まで実装済みで、中身の空のカードはありません。

**力学**：自由落下と終端速度／斜方投射／単振り子／強制振動と共振／二重振り子／一次元衝突／連成振動
**重力・天体力学**：二体問題とケプラーの法則／三体問題／人工衛星と脱出速度
**電磁気**：点電荷の電場と電位／RC 回路／RLC 共振／電磁場中の荷電粒子（Boris 法・3D）／電磁誘導
**波動・光**：弦の定常波／二波源の干渉／ドップラー効果
**熱・統計**：気体分子運動論（マクスウェル分布）／ランダムウォークと拡散
**カオス**：ローレンツ・アトラクタ／ロジスティック写像の分岐図
**相対論**：光時計と時間の遅れ／相対論計算機
**量子**：波束のトンネル効果
**原子核**：放射性崩壊と半減期
**天体物理**：銀河回転曲線とダークマター／宇宙膨張とフリードマン方程式
**実験**：単振り子から g を求める／RC 回路の時定数を測る

---

## 16. 既知の制約と今後

- **同梱は 30 件**です。将来数百件を載せる前提の分類体系（21 カテゴリ・62 タグ・階層）は最初から入っていますが、
  実装済みの現象は 30 件で、残りは同じ仕組みで足していく形になります。
- **static モードの編集はブラウザローカル**です（[2 章](#2-2-つの動作モード)の注記のとおり）。
  複数人で同時に編集したい場合は server モードに切り替えてください。
- **構造化フィールド（パラメータ・グラフ・実験）の編集は JSON エディタ**です。
  専用フォームより素っ気ないですが、スキーマが変わっても壊れず、保存時に同じ検証を通ります。
- **3D は正射影ベース**で、陰面消去や光源はありません。
- **バージョンの差分表示**はありません（旧版の読み込みと復元のみ）。スナップショット同士の比較で追加できます。
- **グラフの画像書き出し**は未実装です（データは CSV / JSON で出せます）。Canvas の `toBlob` で追加できます。
- **多言語化**は入っていません。UI は日本語、コード内の識別子とコメントは英語です。
- **カタログの JSON は一括読み込み**です。数百件規模になったらカテゴリ単位の分割読み込みに変えるのが素直です
  （`scripts/build-content.mjs` の出力を分けるだけで済みます）。

---

## 出典

物理定数は CODATA 2018。三体問題の 8 の字解の初期条件は Chenciner & Montgomery (2000) によります。
