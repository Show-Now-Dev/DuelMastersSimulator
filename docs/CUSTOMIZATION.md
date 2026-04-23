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
