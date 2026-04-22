# BRAINPOOL CORE ARCHITECTURE

> 변경 빈도: 매우 낮음 | 모든 프로젝트 공통 적용
> 이 문서는 경계 정의 문서다. 구현 방법이 아니라 경계를 기술한다.

---

## 1. Cognitive Pipeline (5 Layer)

```
[INPUT]
   ↓
[LANGUAGE LAYER]   → CoreRing
   ↓
[MEANING LAYER]    → post-process
   ↓
[MEMORY LAYER]     → CoreChat
   ↓
[EXPERIENCE LAYER] → Render
```

### 각 레이어 책임

| Layer | 담당 | 책임 | 금지 |
|-------|------|------|------|
| INPUT | 사용자 | 텍스트 입력, 언어 감지 | 번역 로직 |
| LANGUAGE | CoreRing | 번역, 방언, 사전 룩업 | 감정 처리 |
| MEANING | post-process | 감정, 충돌, 의도, 리스크 | 번역 수정 |
| MEMORY | CoreChat | 대화 맥락, 관계 히스토리 | 렌더링 |
| EXPERIENCE | Render | 카드, 배지, 모달, 피드백 | 로직 처리 |

### 데이터 흐름 규칙
- 단방향 only (위 → 아래)
- 레이어 스킵 금지
- 역방향 호출 금지

---

## 2. engine.js = Orchestrator 규칙

engine.js는 오케스트레이터다. 로직을 포함하지 않는다.

### 허용
```js
// 레이어 호출 순서 정의
const translated = await languageLayer(input);
const processed  = await meaningLayer(translated);
const memory     = await memoryLayer(processed);
renderLayer(memory);
```

### 금지
```js
// 로직 직접 구현
if (text.includes('왜')) score += 2;       // ❌ MEANING 레이어 침범
data.translations[0].text;                 // ❌ LANGUAGE 레이어 파싱
history.innerHTML = `<div>...</div>`;      // ❌ EXPERIENCE 레이어 침범
```

### 파일 구조
```
engine.js           ← Orchestrator (호출만)
flow-input.js       ← INPUT 처리
flow-translate.js   ← LANGUAGE LAYER
post-process.js     ← MEANING LAYER
flow-chat.js        ← MEMORY LAYER
flow-render.js      ← EXPERIENCE LAYER
```

---

## 3. post-process 입출력 규격 (고정)

### INPUT
```js
{
  translated: string,       // LANGUAGE LAYER 출력값
  original:   string,       // 사용자 원문
  direction:  'KO→VI' | 'VI→KO'
}
```

### OUTPUT
```js
{
  text:         string,     // 최종 표시 텍스트
  badges:       string[],   // ['conflict', 'risk', 'affection']
  emotionScore: number,     // 0~10
  riskScore:    number,     // 0~10
  intent:       string      // 'NEUTRAL' | 'THREAT' | 'COMPLAINT' | 'AFFECTION'
}
```

### emotion ON/OFF
```js
// post-process 외부에서 제어
postProcess(input, { emotion: true | false });

// post-process 내부는 옵션만 받음, 판단하지 않음
```

---

## 4. 절대 금지 (전 레이어 공통)

- 2개 이상 레이어 로직을 한 파일에 작성 ❌
- 레이어 역방향 호출 ❌
- "편의상 합치기" ❌
- engine.js에 로직 추가 ❌
- post-process에서 번역 수정 ❌
- Render에서 API 직접 호출 ❌

---

## 5. 작업 전 체크리스트

```
□ 이 작업이 단일 레이어에만 영향을 주는가?
□ 데이터 흐름이 단방향인가?
□ engine.js에 로직이 추가되지 않는가?
□ post-process 입출력 규격이 유지되는가?
□ 2개 이상 레이어를 동시에 수정하는가? → 중단 후 질문
```

---

## 6. 인프라 공통

| 항목 | 내용 |
|------|------|
| 배포 | Vercel (Hobby — API 12개 한도) |
| DB | Supabase PostgreSQL |
| 미디어 | Cloudinary (preset: corenull) |
| 인증 | device_id (localStorage) |
| 프론트 | Vanilla JS ES Modules |
| AI | Gemini 2.0 Flash |

---

## 7. 리팩토링 진입 조건

```
현재 상태: 경계 고정 단계 (리팩토링 금지)

진입 허용 조건:
  □ 이 문서 확정
  □ post-process 규격 확정
  □ engine.js Orchestrator 역할 확정
  □ 세션 단위 작업 계획 수립

진입 후 작업 순서:
  1. flow-translate.js 분리
  2. post-process.js 분리
  3. flow-render.js 분리
  4. flow-chat.js 분리
  5. engine.js 정리 (마지막)
```
