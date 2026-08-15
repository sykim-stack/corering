# Vocabulary & Phrase Auto-Extraction Pipeline — 작업 정리
**작성일**: 2026-08-09
**담당**: 클로5 (CoreRing)
**상태**: 배포 완료, 데이터 축적 대기 중

---

## 1. 왜 만들었나

CoreRing의 단어 클릭 기능(`ChatBubble` → `WordModal`)은 원래 "실제 대화 속에서 나온 표현을 그 자리에서 클릭해 배운다"는 설계였다. 하지만 조회 대상이 `tp_translations`(사람이 수동으로 입력한 방언 사전)뿐이라, 사용자가 실제로 주고받은 새 단어는 사전에 없으면 클릭해도 빈 카드만 떴다. 즉 UI/API는 다 있었지만 **채워줄 데이터가 들어오지 않는 깡통 파이프**였다.

이번 작업은 그 구멍을 메워, 대화에서 나온 표현이 자동으로 사전화되어 이후 클릭 시 바로 조회되도록 만들었다.

---

## 2. 설계 원칙

- **새 AI 호출을 추가하지 않는다.** 기존 `analyze.js`의 Gemini 프롬프트(emotion/risk/intent 분석)에 `keywords`, `context_type` 필드만 추가해서 같은 호출 안에서 함께 뽑는다.
- **글로벌화 대응.** `direction`(`KO_VI`) 방식 대신 `source_language`/`target_language` 컬럼 사용. 방언은 `language` 코드의 variant(`vi-south` 등)로 취급해 하드코딩 컬럼을 늘리지 않는다.
- **기존 정성 데이터 보호.** `tp_translations`(사람이 입력한 방언 사전)는 그대로 두고, 자동 추출 데이터는 별도 테이블(`tp_lexicon`)에 쌓아 **보완 조회**로만 사용한다.
- **엔진이 아니라 저장 레이어.** 어휘/구문 추출은 Emotion/Dialect처럼 "문장을 이해하는" 별도 엔진이 아니라, 이미 나온 분석 결과를 저장만 하는 Persistence 함수(`saveVocabulary`, `savePhrase`)로 구현. (Grok PM 피드백 반영)
- **Archive 원칙 유지.** `tb_trans_logs`는 절대 수정하지 않는다.

---

## 3. 구현 내용

### 3-1. 리네이밍
`brain-engine/layers/CoreNullLayer.js` → `RingLexiconLayer.js`
- CoreNull(클로3) 소유로 오인되던 이름을 CoreRing 자기 소유로 정정
- 실제로는 CoreNull과 무관하게 `tp_translations`, `user_vocabulary`, `audio_contributions`, `tp_conflicts`를 다루는 CoreRing 사전 레이어였음
- `app/api/phrase/route.ts`의 import만 함께 수정, 기능 변화 없음
- 죽은 백업 파일 `CoreNullLayer.js.bak` 삭제

### 3-2. 신규 스키마
```
tp_lexicon    — 언어중립 어휘 테이블 (자동 추출)
tp_phrases    — 언어중립 구문 테이블 (자동 추출)
```
- `tp_lexicon.translation_group_id`로 같은 개념의 언어쌍(ko/vi)을 묶음
- `unique(language, normalized_lemma)` — 중복 단어는 frequency만 증가
- `tp_phrases.phrase_hash`로 중복 구문 판정 (공백/기호 차이 흡수)
- `status`: `auto` → (향후) `verified` → `deprecated` 생명주기
- RLS: SELECT는 전체 공개, INSERT/UPDATE는 service_role(서버)만

마이그레이션 파일: `supabase/migrations/20260807_tp_lexicon_phrases.sql`

### 3-3. Gemini 프롬프트 확장 (`brain-engine/engines/emotion/analyze.js`)
기존 JSON 응답 스키마에 추가:
```json
{
  "context_type": "greeting|question|emotion|request|gratitude|complaint|neutral",
  "keywords": [{ "ko": "...", "vi": "..." }]  // 최대 3개, 인사/추임새는 빈 배열
}
```
새 API 호출 없음 — 기존 emotion 분석 호출에 필드만 추가.

### 3-4. 저장 함수 (`brain-engine/connectors/storage.js`)
- `saveVocabulary(ctx)` — keywords를 `tp_lexicon`에 upsert (이미 있으면 frequency +1)
- `savePhrase(ctx)` — 문장 쌍을 `tp_phrases`에 upsert (phrase_hash 기준)

### 3-5. 파이프라인 연결
백그라운드 분석 단계(emotion 분석 직후)에서 두 함수 호출:
- `app/api/chat/route.ts` (채팅방 모드)
- `app/api/brainpool/route.ts` (번역기 모드)

두 경로 모두 `source: 'chat' | 'translator'`로 태깅되어 나중에 구분 가능.

### 3-6. `getWordData` 조회 확장 (`RingLexiconLayer.js`)
조회 순서:
1. `tp_translations`(정성 사전) 우선 조회
2. 없으면 `tp_lexicon`(자동 추출)으로 보완 조회 — `translation_group_id`로 번역 짝을 찾아 `meaning` 채움
3. 그래도 없으면 `tb_trans_logs` 분석값만으로 카드 표시

응답에 `source: 'curated' | 'auto_extracted' | 'analysis_only'` 필드 추가 (현재 UI에서는 미사용, 필요 시 `WordModal.tsx`에서 구분 표시 가능).

---

## 4. 검증 결과 (2026-08-09)

- 빌드 통과 (`npx next build`)
- 배포 완료
- 실제 채팅 사용 중 `tp_lexicon`에 8건 자동 적재 확인 (예: "좋아해" ↔ "Thích", "어떤식으로" ↔ "như thế nào")
- `WordModal`에서 "좋아해" 클릭 → 뜻/감정(loving)/위험도 정상 표시 확인 — **전체 루프 정상 동작**

---

## 5. 알려진 한계 (의도적 보류)

### "쓰임새" 필드는 단어별 학습 데이터가 아님
`WordModal`에 표시되는 "애정이 담긴 표현" 같은 문구는 `tp_lexicon`에서 온 게 아니라, 해당 단어가 마지막으로 등장한 `tb_trans_logs` 행의 **문장 전체 intent**를 재활용한 것. 단어 자체에 축적된 뉘앙스/용례 설명이 아니므로, 같은 단어가 다른 맥락으로 쓰이면 매번 다르게(또는 부정확하게) 보일 수 있음.

**향후 옵션 (지금 착수 안 함):**
- A안(가벼움): `tp_lexicon`에 `usage_note` 컬럼 추가, keyword 추출 시 문맥 한 줄도 같이 저장
- B안(정석): `language_knowledge`의 emotion_pattern처럼 단어별로 반복 관찰을 축적해 배치로 승격 — 한 번의 관찰이 아닌 반복 검증된 지식이 됨. 기존 Language Knowledge Pipeline 철학과 가장 잘 맞음

### 재진단 전까지 로직 변경 안 함
`language_knowledge`(Phase 1)와 마찬가지로, `tp_lexicon`/`tp_phrases`도 지금은 **데이터 축적 단계**다. 섣불리 구조를 더 얹기보다, 실제 쌓인 데이터를 보고 판단하는 것이 안전하다는 원칙을 그대로 따른다.

---

## 6. 다음 체크포인트

| 조건 | 할 일 |
|---|---|
| `tp_lexicon` 데이터가 충분히 쌓였을 때 (기준: 육안 확인 또는 별도 진단 스크립트) | 단어별 반복 패턴이 보이는지 확인 → "쓰임새" 기능 A/B안 중 선택 |
| `tb_trans_logs`가 1500~2000건 도달 | `diagnose-language-knowledge.js` 재실행, Phase 1 임계값 재검토 (기존 예정 항목, 이번 작업과 별개) |
| `tp_translations`(정성 사전)와 `tp_lexicon`(자동) 데이터 규모 역전 시 | 조회 우선순위(현재: 정성 우선) 재검토 필요할 수 있음 |

---

## 7. 변경 파일 목록

```
신규:
  brain-engine/layers/RingLexiconLayer.js  (CoreNullLayer.js에서 리네이밍)
  supabase/migrations/20260807_tp_lexicon_phrases.sql

수정:
  brain-engine/engines/emotion/analyze.js   (keywords/context_type 추출)
  brain-engine/connectors/storage.js         (saveVocabulary/savePhrase 추가)
  app/api/chat/route.ts                      (파이프라인 연결)
  app/api/brainpool/route.ts                 (파이프라인 연결)
  app/api/phrase/route.ts                    (import 경로 수정)

삭제:
  brain-engine/layers/CoreNullLayer.js
  brain-engine/layers/CoreNullLayer.js.bak
```