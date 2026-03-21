\# ToDo



\## 🥇 High Priority（最優先）



\### 1. Card Definition System（JSON化）

\- カード情報をJSONで管理する

&#x20; - name

&#x20; - cost

&#x20; - color

&#x20; - power

&#x20; - type

&#x20; - text

\- CardDefinition と CardInstance を分離する

\- 盤面のカードに情報を表示できるようにする



\### 2. Card Display Enhancement（表示強化）

\- カード内に基本情報を表示する

\- 選択中カードの詳細表示UIを追加する

&#x20; - 空きスペースにテキスト表示

&#x20; - 将来的に拡張可能な設計にする



\---



\## 🥈 Medium Priority（重要）



\### 3. Deck Reveal System（山札の公開状態）

\- カードに isRevealed 状態を追加する

\- 山札から公開されたカードは再度開いても状態を維持する

\- 「裏向き」と「非公開」を分離する



\### 4. Resolution Zone Implementation

\- Resolutionゾーンへの移動処理を追加する

\- 既存のZoneシステムに統合する



\### 5. Multi Untap System（一括アンタップ）

\- バトルゾーン＋マナゾーンの一括アンタップ機能を追加する

\- 選択中カードはアンタップ対象から除外できるようにする



\---



\## 🥉 Low Priority（後回しOK）



\### 6. GR Zone Special Rule

\- GRゾーンへの移動時：

&#x20; - 裏向きで追加する

&#x20; - 一番下に配置する

\- 特殊ルールとして実装する



\### 7. Dual-Faced Card Support（超次元）

\- 両面カードのデータ構造を追加する

\- 表裏の切り替えを実装する



\---



\## 🧪 UI / UX Improvements



\### 8. Deck Modal UX Improvement

\- 山札のモーダル表示を改善する

\- 「上から〇枚」表示を強化する

\- 公開カードと非公開カードの混在表示を可能にする



\---



\## 🧩 Future Ideas（将来拡張）



\- 効果処理UI（対象選択など）

\- ドラッグ＆ドロップ操作

\- 対戦モード（プレイヤー2画面）

\- ログ強化（詳細な履歴）

