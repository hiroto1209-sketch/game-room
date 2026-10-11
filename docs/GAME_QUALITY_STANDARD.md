# GAME ROOM — 恒久的なゲーム品質基準

> この文書は、GAME ROOMの**全てのゲーム機能変更**に適用する品質ゲートです。FPSだけでなく地形、アーケード、オセロ、写真・看板共有、UI、オンライン状態にも適用します。
>
> "コードが動く" ≠ "遊べる"。ユーザーが全要件を事細かに指定しなくても、変更に必要な標準仕様は実装者が調査しテストすること。

## 目的と優先順位

1. 既存の操作・共有データ・公開URLを壊さないこと。
2. iPhone Safariの実際の遊びやすさ（タッチ、視認性、安全領域）を最優先すること。
3. THREE.js/Vite/TypeScriptとCloudflare Workers/Durable Objectsを維持すること。
4. 静的ワールド・草木の描画最適化を維持し、装飾目的だけの毎フレームアニメーションや多量のライトを増やさないこと。
5. サーバー権威を守ること。HP・武器解放・命中・射撃間隔・リスポーン・ピースモードの判定をクライアントへ移さないこと。

## 調査 → 合格条件 → 実装 → 反証テストの順序

| ステップ | 省略禁止の成果物 |
|---|---|
| A — 目的を特定 | 画面の見た目ではなく、プレイヤーの成功行動を一文で書く |
| B — 標準仕様の調査 | 公式ドキュメント/参考作品から、著作権を侵害せず移植できる技術パターンを選定 |
| C — 暗黙の要件を補完 | 視野、入力同時性、モバイルUI、通信遅延、性能、安全性を確認 |
| D — 故障モード列挙 | 干渉する操作、画面比、ネットワーク断、視界遮蔽を想定 |
| E — 実装前の受入基準 | 期待する見え方、数値で検査できる条件、スクリーンショット状態を決める |
| F — バックアップ・PR | mainのバックアップブランチを切り、小さな変更へ分割 |
| G — 実装・テスト | 型、単体、WebSocket、描画、デバイスサイズ、画面画像 |
| H — 再検証 | 不合格は原因を特定し、無理な制限解除やテストの水増しは禁止 |
| I — iPhone実機確認 | リアルSafari、FIRE+LOOK+MOVE+JUMP+ADS、画質/性能/通信を実地確認 |
| J — 正確な報告 | 実装・自動検証済み・実機未検証・残課題を分けて書く |

## FPS の品質契約

| 状態 | 必須の合格条件 |
|---|---|
| 通常射撃 | 中央レティクルの奥に目標が見え、射撃方向が合う |
| ADS | **10m先の正面標的が見えること**。銃本体が中央を塞がない |
| ADSの照準器 | 光学中心はカメラの `-Z` 軸と一致し、真ん中は穴が開いた薄いリング |
| 画面サイズ | 390×844 縦、844×390 横、1280×720 PCで遮蔽がない |
| 射撃中 | 反動/フラッシュ時も中心標的が見える |
| iOSマルチタッチ | 移動親指・FIRE指・別のLOOK指が独立し、他の指を離しても射撃が止まらない |
| 発射/被弾 | クライアントは弾道のリクエストのみ。HPやキルはDurable Objectが計算 |
| HUD | HP等は小型/半透明。移動操作に `pointer-events` で干渉しない |

### 必須の静的＋動的検証

- `src/combat/WeaponViewmodel.ts` は「視覚用銃本体」と「透過した照準器」を分ける。
- `isTargetCorridorClear()`：Three.js Raycasterで中心の複数の方向が銃本体と衝突しないことを検査する。
- `sightProjectionError()`：`Vector3.project(camera)` を使って照準リング中央が正しくNDCの(0,0)へ映ることを検査する。
- `tests/fps-visual.test.mjs`：Chromium上で正面10mの鮮やかな標的が中央に描かれているか**ピクセル数**で検証する。縦/横/PCそれぞれ通常射撃・ADS・発射中をPNG保存する。
- QA標的は `localhost`/ `127.0.0.1` の `?fpsVisualTest=1` でのみ存在する。GitHub Pages上でQAモードは露出させない。
- スクリーンショットの結果はGitHub Actions artifact `fps-visual-screenshots` に格納し、失敗時は差分だけでなく、実際に**どの領域が隠れたか**を人間が目視で確認する。
- Playwright ChromiumのモバイルエミュレーションはiPhone Safari実機の代わりではない。実機の達成を誤って報告しない。

## 実行コマンド

```sh
npm run typecheck
npm test
npm run build
npm run check:worker
npm run test:realtime
npx playwright install chromium
npm run test:visual
```

### 自動テストでは代替できない項目

- 実際のiPhone Safariで移動しながらFIRE長押し/別指LOOK/ADS/JUMPが同時に効くか。
- 3人が同じ招待URLで移動と被弾を共有できるか。
- iPhoneのGPUフレーム時間、FPS(p50/p95)、draw calls、メモリ、長時間の発熱。
- 池、パーティハウス裏、ARMORYへの扉、写真・看板・オセロなどの視覚検査。

確認できない場合は**未確認**と報告し、30/60FPSなどを保証しない。

## 参考：一次情報

- Three.js: https://threejs.org/docs/pages/Vector3.html
- Three.js: https://threejs.org/docs/pages/Object3D.html
- Three.js: https://threejs.org/docs/pages/Camera.html
- MDN TouchEvent: https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Using_Touch_Events
- Playwright visual artifacts: https://playwright.dev/docs/api/class-testoptions
- Krunker Controls: https://krunker.io/guides/controls/
- PlayCanvas FPS tutorial: https://developer.playcanvas.com/en/tutorials/first-person-shooter-starter-kit/

## 変更報告テンプレート

**不具合/目的:** / **根本原因:** / **変更ファイル:** / **調査ソース:** / **テスト成績:** /
**スクリーンショット結果:** / **実機未確認:** / **性能の前後比較:** / **バックアップ:** /
**PR・コミット:** / **本番への展開順序:** / **残課題:**

合格条件を満たしていない機能を「完成」と呼ばないこと。
