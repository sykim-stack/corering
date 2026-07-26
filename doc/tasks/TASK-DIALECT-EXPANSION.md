# TASK: 남부 방언 사전(tp_translations) 확장

**발행자**: 클로5 (CoreRing 담당)
**대상**: 방언/사전 데이터 작업 가능한 에이전트 (클로3 CoreNull 또는 위임 가능한 인스턴스)
**우선순위**: P2 (급하지 않음)
**참조**: `lib/analysis/dialect.ts`, `brain-engine/layers/CoreNullLayer.js`, ADR-004 (Pronunciation data는 CoreRing 책임)

---

## 배경

CoreRing의 방언 감지는 현재 `lib/analysis/dialect.ts`의 `SOUTH_LEXICON` / `NORTH_LEXICON`
사전 매칭에 의존한다 (규칙 기반 우선, 불확실할 때만 Gemini 보완).

이 사전은 현재 아내의 실사용 패턴 기반 수십 개 어휘로 제한적이다.
AI Hub 등 외부 베트남어 말뭉치를 활용하면 방언 어휘를 확장할 수 있으나,
**수작업 검수가 반드시 필요**하여 자동화 스크립트만으로는 불가능하다.

---

## 목표

1. `lib/analysis/dialect.ts`의 `SOUTH_LEXICON` / `NORTH_LEXICON` 사전 확장
2. `tp_translations` 테이블(CoreNull 소유 스키마)에 신규 방언 어휘 항목 추가

---

## 절차 (반드시 순서 준수)

### Step 1: 소스 선정 및 라이선스 확인
- AI Hub 등 외부 데이터 사용 시, 다운로드 승인 조건과 상업적 이용 가능 여부를 먼저 확인한다.
- 코어링은 실서비스 중인 앱이므로, 라이선스 미확인 데이터는 절대 사용하지 않는다.
- 확인 결과를 이 문서 하단 "라이선스 확인 로그"에 기록한다.

### Step 2: 방언 후보 추출
- 원천 텍스트에서 남부(메콩델타/호치민) 특유 어휘 후보를 추출한다.
- 자동 추출은 참고용으로만 사용하고, 반드시 사람이 다음을 확인한다:
  - 실제로 남부에서만 쓰이는 표현인가 (전국 공용 표현이 섞이지 않았는가)
  - 기존 SOUTH_LEXICON과 중복되지 않는가
  - 표준어(북부) 대응 표현이 명확한가

### Step 3: 형식 맞추기
lib/analysis/dialect.ts의 SOUTH_LEXICON은 다음 형식을 따른다:
```ts
'남부표현': '북부표준어',
```

tp_translations 테이블 삽입 시 필드는 CoreNullLayer.js의 스키마 주석을 따른다:
```
standard_word, southern_word, hue_word, mekong_word, meaning_ko, meaning_en,
part_of_speech, category_main, category_sub, pronunciation_diff, conversion_rule,
frequency, formality_level, generation, region, example_northern, example_southern,
notes, entry_type, dialect, status, source, emotion_score, conflict_weight
```
- source 필드에 데이터 출처를 반드시 기록한다 (예: 'aihub-corpus-2026')
- status는 최초 등록 시 'pending'으로 하고, 검수 완료 후에만 'verified'로 변경한다

### Step 4: 검증
- 추가 전후로 lib/analysis/dialect.ts의 기존 테스트 문장들이 오분류되지 않는지 확인한다.
- 최소 10개 이상의 실제 사용 문장으로 detectDialect() 결과를 육안 검토한다.

### Step 5: 반영
- 코드 변경(dialect.ts)과 DB 변경(tp_translations)은 별도 커밋으로 분리한다.
- 커밋 메시지에 반드시 어휘 개수와 출처를 명시한다.
  예: "TASK-DIALECT: 남부 방언 어휘 32개 추가 (source: aihub-corpus-2026, 검수 완료)"

---

## 금지 사항

- 라이선스 미확인 데이터 사용 금지
- 사람 검수 없이 자동 추출 결과를 그대로 사전에 삽입 금지
- SOUTH_LEXICON과 tp_translations를 동시에 대량 수정하는 단일 커밋 금지 (Master Prompt Section 6 예외정책 위반 소지)

---

## 완료 후 보고 형식 (AI_Collaboration_Governance.md REPORT Standard 준수)

```text
### 작업 요약
[추가된 어휘 개수, 출처, 검수 방식]

### 변경 파일
- lib/analysis/dialect.ts
- (DB) tp_translations

### 영향 범위
- 방언 감지 정확도 (남부/북부 판별)

### Governance Self Check
- [ ] 라이선스 확인 완료
- [ ] 수작업 검수 완료
- [ ] 기존 테스트 문장 오분류 없음
- [ ] 코드/DB 커밋 분리됨

### Review Required
- [필요 시 기재]
```

---

## 라이선스 확인 로그
_(작업 시작 전 이 섹션에 확인 결과를 기록할 것)_

| 날짜 | 데이터 출처 | 라이선스 확인 결과 | 확인자 |
|---|---|---|---|
| | | | |
