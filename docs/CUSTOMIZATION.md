# UI カスタマイズガイド

「○○を変えたいけどどこを直せばいい？」という質問への回答集。  
変更はすべて **`style.css`** 1 ファイルで完結します（JS は触らなくてよい）。

---

## 仕組みの基礎知識

スタイルは大きく 2 系統に分かれています。

| 系統 | 単位 | 特徴 |
|---|---|---|
| **カード単位系** | `calc(var(--card-w) * 係数)` | カードサイズに連動して画面幅に追従する |
| **固定 UI 系** | `rem`（例: `0.9rem`） | 画面幅によらずほぼ固定サイズ |

カード上のすべての文字・アイコンはカード単位系。  
ボタン・ラベルなど盤面以外の UI は固定 rem 系がほとんど。

---

## カード上のテキスト（ゲームボード）

**コスト・カード名・パワー・J バッジ** を変えたい場合、それぞれ対応するセレクタ内の `font-size` の係数を変える。

```
.card__cost          → font-size: calc(var(--card-w) * 0.14)
.card__name          → font-size: calc(var(--card-w) * 0.11)
.card__power         → font-size: calc(var(--card-w) * 0.115)
.card__jokers-badge  → font-size: calc(var(--card-w) * 0.13)
```

係数を上げると大きくなる。`--card-w` は 40〜80px の範囲で変動するため、  
絶対サイズは `係数 × 40px`〜`係数 × 80px` の間になる。

---

## ゾーンラベル・枚数表示

```
.zone-title  → font-size: calc(var(--card-w) * 0.135)  ← ゾーン名 (HAND, DECK…)
.zone-count  → font-size: calc(var(--card-w) * 0.125)  ← "X cards" の枚数
```

---

## スタックの枚数バッジ（重なったカードの数字）

```
.stack-badge → font-size: calc(var(--card-w) * 0.22)
```

---

## 面切り替えインジケーター（◀ / ▶）

```
.card__form-nav → font-size: calc(var(--card-w) * 0.3)
                  padding: 0.05em 0.15em
.card__form-nav--prev → left: 2px   ← カード左端からのオフセット
.card__form-nav--next → right: 2px  ← カード右端からのオフセット
```

タップしやすくしたい → `.card__form-nav` の `padding` を広げる（例: `0.15em 0.3em`）  
アイコンを大きくしたい → `font-size` の係数を上げる（例: `0.3` → `0.4`）

---

## モーダル内のカード

```
.modal-panel → --modal-card-w: clamp(80px, 10vw, 120px)
```

`clamp(最小, 比率, 最大)` の最大値を上げると大きくなる。  
カード内テキスト（コスト・名前・パワー）はこの変数に連動するため、この 1 行で全部まとめて変わる。

カード詳細モーダル（クリックで開く大きい表示）は同セレクタ内で別値を上書きしている：

```
.modal-panel--card-detail → --modal-card-w: clamp(100px, 45vw, 200px)
```

---

## カード詳細パネル（盤面右の INFO エリア）

```
.cd-cost     → font-size: 0.8rem
.cd-name     → font-size: 0.85rem
.cd-power    → font-size: 0.85rem
```

（race-row / type-row / abilities なども同じ `cd-*` セレクタ群で管理）

---

## 全ボタン共通

```
button → font-size: 0.9rem
         padding: 0.45rem 0.75rem
```

ここを変えると全ボタンが一括で変わる。  
特定ボタンだけ変えたい場合はそのボタンのセレクタ（例: `.btn--return-to-menu`）を個別に上書きする。

---

## ドロップダウン（セレクトボックス）

```
select → font-size: 0.85rem
```

---

## ヘッダーのタイトル

```
header h1 → font-size: 1.1rem
```

---

## リンクオブジェクトの「∽」バッジ幅

バッジは `.link-badge` の `left` / `right` で幅を制御する。

```css
/* 現在の設定（各端から card-w の 0.5 倍内側） */
.link-badge {
  left:  calc(var(--card-w) * 0.5);
  right: calc(var(--card-w) * 0.5);
}
```

- 係数を **小さく**する（例 `0.3`）→ バッジが横に広がる  
- 係数を **大きく**する（例 `0.8`）→ バッジが短くなる  
- `left: 0; right: 0` にすると端から端まで伸びる

> 注意: 覚醒リンク統合表示（1 枚表示）のときはバッジ幅が JS で 1 枚分に固定されるため、この設定の影響を受けない。

---

## よく使う調整チートシート

| やりたいこと | 変えるセレクタ | 変えるプロパティ |
|---|---|---|
| カード上の文字を大きく | `.card__name` など | `font-size` の係数 |
| ◀/▶ を大きく・押しやすく | `.card__form-nav` | `font-size` 係数 / `padding` |
| モーダル内のカードを大きく | `.modal-panel` | `--modal-card-w` の最大値 |
| 全ボタンを押しやすく | `button` | `padding` |
| ゾーン名を大きく | `.zone-title` | `font-size` の係数 |
| ∽ バッジの横幅を変える | `.link-badge` | `left` / `right` の係数 |

---

## カード検索パネルのレイアウト

### 行の表示順を変えたい

**ファイル**: `ui/shared/cardSearchUI.js`

`collapsible.appendChild(...)` の呼び出し順が、そのまま画面上の表示順になる。
行を上下に移動したい場合は、**対応する変数の「ビルド〜append」ひとかたまりを**切り取って別の位置に貼り付ける。

現在の並び順（変数名 → 表示内容）:

| 変数名 | 表示内容 |
|---|---|
| `freewordRow` | フリーワード入力 + OR/AND ピル |
| `targetRow` | カード名 / テキスト / 種族 チェックボックス |
| `colorModeRow` | 単色 / 多色 |
| `civRow` | 文明（光〜無色） |
| `excludeRow` | 除外文明（多色チェック時のみ表示） |
| `twinRow` | ツインパクトを含む |
| `costRow` | コスト範囲 |
| `powerRow` | パワー範囲 |
| `btnRow` | 検索 / クリア ボタン |

**例: `powerRow` を `costRow` の上に移動する**  
`collapsible.appendChild(powerRow)` の行を `collapsible.appendChild(costRow)` の直前に移動するだけでよい。
ただし変数は使う前に宣言されている必要があるので、ビルドコード（`var powerRow = ...` から `powerRow.appendChild(...)` まで）ごと移動すること。

### チェックボックス行（カード名・テキスト・種族）の左余白を変えたい

**ファイル**: `style.css`

```css
.cm-search-row--sub {
  padding-left: 0;   /* 現在値。5rem にするとフリーワード入力の左端に揃う */
}
```

### 文明チェックボックスをスマホで1行に収めたい

**ファイル**: `style.css`

以下のクラスで折り返し禁止・横スクロールを制御している（現在この設定で実装済み）:

```css
.cm-civ-row            { flex-wrap: nowrap; overflow-x: auto; }
.cm-civ-row .cm-civ-group { flex-wrap: nowrap; }
```

チップ自体のサイズを縮小してスクロールなしで収めたい場合は `style.css` の `.cm-civ-label` を調整する:

```css
.cm-civ-label {
  padding: 0.15rem 0.35rem;   /* 現在: 0.2rem 0.5rem */
  font-size: 0.75rem;          /* 現在: 0.8rem */
}
```

### 特定の行を非表示にしたい

各行には固有クラスが付いていないため、`style.css` での非表示はセレクタが複雑になる。  
JS 側で対象の行変数に専用クラスを追加しておくのが確実:

```javascript
// ui/shared/cardSearchUI.js で該当行のクラスを追加
var powerRow = _el('div', { className: 'cm-search-row cm-power-row' });
```

```css
/* style.css で非表示 */
.cm-power-row { display: none; }
```

### OR/AND ピルの見た目を変えたい

**ファイル**: `style.css`

```css
/* ピル全体のサイズ・角丸 */
.cm-or-and-pill { border-radius: 999px; }

/* 各セグメントの余白・文字サイズ */
.cm-or-and-pill__seg { padding: 0.18rem 0.7rem; font-size: 0.78rem; }

/* アクティブ色（現在はアクセントカラー） */
.cm-or-and-pill[data-mode="or"]  .cm-or-and-pill__seg--or,
.cm-or-and-pill[data-mode="and"] .cm-or-and-pill__seg--and {
  background: var(--accent);   /* 色を変えるにはここを書き換える */
}
```

---

## カード登録画面のサンプル表示を編集したい

**ファイル**: `ui/cardEditor/cardEditor.js`

### 仕組みの概要

サンプルウィジェットはすべて `_buildSampleWidget(config)` という共通関数で生成している。  
メイン・超次元・超GR それぞれの関数の中に `_buildSampleWidget({ faces: [...] })` の呼び出しがあり、
その `faces` 配列を書き換えるだけでサンプル内容が変わる。

### faces 配列の書き方

要素は **カードブロック** と **区切り行** の 2 種類。

#### カードブロック（1 枚分のカード情報）

```javascript
{
  nameHTML: '《<ruby>満韻炎霊<rt>イフリート・フリート</rt></ruby>キャノンボール》',
  // または（ルビが不要な場合）
  nameText: '《ガイアール・カイザー》',
  rows: [
    'カード名　レアリティ　文明　(コスト)',
    'クリーチャー：種族　パワー',
    '能力テキスト1',
    '能力テキスト2',
  ],
}
```

- `nameHTML` と `nameText` は **どちらか一方** を使う（両方書いた場合は `nameHTML` が優先）
- `rows` はWikiからコピーした行をそのまま 1 行ずつ配列に入れる

#### ルビ（読み仮名）の書き方

Wiki の `{{読み仮名|ふりがな}}` 記法を HTML の `<ruby>` タグに変換して `nameHTML` に書く。

```javascript
// Wiki表記: {{満韻炎霊|イフリート・フリート}}キャノンボール
// ↓ HTML変換後:
nameHTML: '《<ruby>満韻炎霊<rt>イフリート・フリート</rt></ruby>キャノンボール》'

// 複数箇所にルビがある場合も同様に並べる
nameHTML: '《♪<ruby>夏草<rt>なつくさ</rt></ruby>や イフリートによる <ruby>夢<rt>ゆめ</rt></ruby>の<ruby>跡<rt>あと</rt></ruby>》'
```

#### 区切り行（ツインパクト・多面カードの面の切れ目）

```javascript
{ divider: '（ツインパクトは1行空ける）' }
```

ヘッダーと同じ青いバーで表示される。`divider` のテキストは説明として自由に変更してよい。

### 構成パターン別サンプル

#### 単体カード（通常・超GR）

```javascript
faces: [
  { nameText: '《カード名》', rows: ['行1', '行2'] },
]
```

#### ツインパクト（メイン）

```javascript
faces: [
  { nameHTML: '《上面名（ルビHTML）》', rows: ['上面行1', '上面行2'] },
  { divider: '（ツインパクトは1行空ける）' },
  { nameHTML: '《下面名（ルビHTML）》', rows: ['下面行1', '下面行2'] },
]
```

#### 多面カード（超次元）

```javascript
faces: [
  { nameText: '《面1名》', rows: ['面1行1', '面1行2'] },
  { divider: '── 面2 ──' },
  { nameText: '《面2名》', rows: ['面2行1', '面2行2'] },
  // 3面以上も同様に続けられる
  { divider: '── 面3 ──' },
  { nameText: '《面3名》', rows: ['面3行1', '面3行2'] },
]
```

### 各ゾーンの `_buildSampleWidget` 呼び出し箇所

| ゾーン | 関数名 | 検索するコメント |
|---|---|---|
| メイン | `_addMainInputs` | `// ── メインゾーン サンプル` |
| 超次元 | `_addHyperspatialInputs` | `// ── 超次元 サンプル` |
| 超GR | `_addSuperGRInputs` | `// ── 超GR サンプル` |
