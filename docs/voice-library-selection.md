# Voice Library 選定記録

MVP の「分身の声」マッチング用プリセット voice（8 枠）を ElevenLabs Voice Library から選定するための記録ドキュメント。

- 選定基準：`docs/mvp-scope.md` 7 章 Q11 を参照
- 目的：8 枠 A〜H に入れる voice を確定し、最終的に `lib/presetVoices.ts` に JSON 化する
- 試聴環境：https://elevenlabs.io/app/voice-library（モデル：`eleven_turbo_v2_5`）

---

## 試聴手順

1. Voice Library を開き、左サイドの絞り込みを下表の条件でかける
2. 候補 voice を **1 枠あたり 2〜3 個** ピックアップして本ドキュメントに記録
3. 各候補を短文（下記「試聴用サンプル文」）で再生し、チェック項目を評価
4. 枠ごとに採用 1 / 補欠 1 を決定
5. 全 8 枠確定後、5 軸ベクトル（ピッチ / 明度 / テンポ / 性別 / 年代）を人手付与 → `lib/presetVoices.ts` に JSON 化

---

## 試聴用サンプル文（英語・日常会話寄り）

Voice Library の preview には長めのデフォルト文が入っているため、Turbo v2.5 での実使用感を確かめたい場合は以下を手動入力して比較する。

- 短文：`"Hey, could you say that one more time? I didn't catch it."`
- 中文：`"I've been learning English for a while, but I still get nervous when I have to speak out loud."`
- 感情入り：`"That's actually a really good point. I hadn't thought about it that way."`

---

## チェック項目（全枠共通）

各候補に対して以下を評価（○ / △ / ×）。1 つでも × があれば原則不採用。

- [ ] デフォ枠（Bella / Adam / Rachel / Antoni / Domi / Elli / Josh 等）ではない
- [ ] 演劇的すぎず、日常会話として自然
- [ ] 強い地域訛り（Southern US / Cockney / Scottish 等）がない
- [ ] `eleven_turbo_v2_5` で短文が破綻なく再生される
- [ ] 子音が立ちすぎていない（s / t の刺々しさが控えめ）
- [ ] ブランド世界観（やさしい・寄り添う）と整合する

---

## 枠別候補リスト

### 枠 A：男性・20 代前半・明るめ／やや高め

**絞り込み条件**：Gender = Male / Age = Young / Accent = American (neutral) or International / Use Case = Conversational

| 候補 | voice_id | name | 試聴メモ | チェック | 採否 |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

**決定**：採用 = ／ 補欠 = 

---

### 枠 B：男性・30 代・落ち着き／中低域

**絞り込み条件**：Gender = Male / Age = Middle Aged / Accent = American or British (mild) / Use Case = Conversational or Narration

| 候補 | voice_id | name | 試聴メモ | チェック | 採否 |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

**決定**：採用 = ／ 補欠 = 

---

### 枠 C：男性・40〜50 代・落ち着き／低め／温度感あり

**絞り込み条件**：Gender = Male / Age = Old / Accent = American or British (mild) / Use Case = Narration

| 候補 | voice_id | name | 試聴メモ | チェック | 採否 |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

**決定**：採用 = ／ 補欠 = 

---

### 枠 D：女性・20 代前半・明るめ／柔らかい

**絞り込み条件**：Gender = Female / Age = Young / Accent = American (neutral) or International / Use Case = Conversational

| 候補 | voice_id | name | 試聴メモ | チェック | 採否 |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

**決定**：採用 = ／ 補欠 = 

---

### 枠 E：女性・30 代・中音域／落ち着き

**絞り込み条件**：Gender = Female / Age = Middle Aged / Accent = American (neutral) / Use Case = Conversational

| 候補 | voice_id | name | 試聴メモ | チェック | 採否 |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

**決定**：採用 = ／ 補欠 = 

---

### 枠 F：女性・40〜50 代・温度感あり／中低域

**絞り込み条件**：Gender = Female / Age = Old / Accent = American or British (mild) / Use Case = Narration

| 候補 | voice_id | name | 試聴メモ | チェック | 採否 |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

**決定**：採用 = ／ 補欠 = 

---

### 枠 G：中性的・20〜30 代・フラット／中音域

**絞り込み条件**：Gender フィルタが Neutral を持たないため、「低めの女性声」または「高めの男性声」から探す / Accent = neutral / Use Case = Conversational

| 候補 | voice_id | name | 試聴メモ | チェック | 採否 |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

**決定**：採用 = ／ 補欠 = 

---

### 枠 H：中性的・30〜40 代・クール／知的

**絞り込み条件**：Gender フィルタに Neutral がないため「低めの女性」or「高めの男性」から / Accent = neutral / Use Case = Narration

| 候補 | voice_id | name | 試聴メモ | チェック | 採否 |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

**決定**：採用 = ／ 補欠 = 

---

## 最終確定リスト（全 8 枠揃ってから記入）

| 枠 | voice_id | name | 想定ペルソナ | 備考 |
|---|---|---|---|---|
| A |  |  | 男性・20 代前半・明るめ／やや高め |  |
| B |  |  | 男性・30 代・落ち着き／中低域 |  |
| C |  |  | 男性・40〜50 代・落ち着き／低め／温度感あり |  |
| D |  |  | 女性・20 代前半・明るめ／柔らかい |  |
| E |  |  | 女性・30 代・中音域／落ち着き |  |
| F |  |  | 女性・40〜50 代・温度感あり／中低域 |  |
| G |  |  | 中性的・20〜30 代・フラット／中音域 |  |
| H |  |  | 中性的・30〜40 代・クール／知的 |  |

**全体バランスチェック**

- [ ] 5 軸（ピッチ / 明度 / テンポ / 性別 / 年代）で分散が確保できているか
- [ ] デフォ枠に偏っていないか
- [ ] 訛りが特定地域に偏っていないか
- [ ] ブランド世界観（やさしい・寄り添う・量産 SaaS 的でない）と整合しているか

---

## 次のステップ（確定後）

1. 8 枠の voice_id を本ドキュメントに記録
2. Claude と協力して 5 軸ベクトル（ピッチ / 明度 / テンポ / 性別 / 年代、各 0.0〜1.0）を人手付与
3. `lib/presetVoices.ts` に JSON 化して export
4. `/echo` フローでコサイン類似度マッチングに接続（Sprint 1 後半）
