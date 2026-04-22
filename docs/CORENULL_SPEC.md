# CORENULL SPEC

> 변경 빈도: 중간 | Phase 진행 시 업데이트

---

## 1. 현재 상태

| 항목 | 내용 |
|------|------|
| Phase | 0 (95% 완료) |
| 배포 | corenull.vercel.app |
| Repo | github.com/sykim-stack/corenull |
| 테스트 집 | slug=hajun |

### 미해결
- 서비스 워커(hajun-sw.js) 충돌
- 공유 UX 재설계 필요
- Library 스토리 삭제 버튼 (보류)

---

## 2. 제품 철학

- 피드 소비 없음 → 공간 탐색
- 숫자 표시 없음 → 방문/체류/소프트 반응
- "좋아요는 평가, 관심은 관계다"
- 동선이 UX, 흔적이 관계, 기억이 재방문을 만든다

---

## 3. DB 스키마 (Phase 0 확정)

### 핵심 테이블

| 테이블 | 주요 컬럼 |
|--------|-----------|
| houses | id, slug, owner_key, name, category, birth_date, hundred_date, cover_url, profile_url |
| rooms | id, house_id, room_name, room_type, event_date, order_num, is_hidden |
| posts | id, house_id, room_id, content, media_urls[], emotion_tag, created_at |
| post_categories | post_id, category_id |
| categories | id, house_id, name, color, is_event, event_date, order_num |
| media | id, house_id, room_id, file_url, media_type, status |
| comments | id, house_id, post_id, author_name, content, lang |
| reactions | id, target_id, target_type, device_id, action_type |
| milestones | id, house_id, title, memo, milestone_date |

### Room 구조
- room_type: `living` | `room` | `library` | `event` | `yard` | `storage`
- 이벤트 탭은 Phase 2에서 재도입 (현재 nav에서 제거됨)
- 이벤트 분류는 categories 테이블로 관리 (rooms.room_type=event 아님)

### 이벤트 포스트 조회 규칙 (중요)
```
❌ /api/posts?room_id=ROOM_ID   (빈 배열 반환)
✅ /api/posts?category_id=XXX   (올바른 방법)

흐름: room_name → category.name 매칭 → category_id 추출 → 포스트 조회
```

---

## 4. API 목록 (12개 한도 — 현재 12개 사용 중)

| 파일 | 역할 |
|------|------|
| api/house.js | 집 통합 조회 + 스토리 CRUD |
| api/posts.js | 글 CRUD (owner_key 검증) |
| api/rooms.js | 이벤트 방 생성/수정/삭제 |
| api/categories.js | 분류 CRUD |
| api/comment.js | 방명록 + 댓글 + reaction 통합 |
| api/upload.js | 미디어 저장 (cover/profile/guest_post) |
| api/media.js | 사진 수정/삭제 |
| api/invite.js | 집 생성 + CoreChat 방 연동 |
| api/onboarding.js | 관심사 + 온보딩 통합 |
| api/share.js | 초대 코드 생성/조회 |
| api/reaction.js | 반응 전용 (batch) |
| api/gemini.js | AI 문구/감정/스토리 |

**추가 불가. 통합 시 action 파라미터 사용.**

---

## 5. 핵심 파일 구조

```
house.html              집 방문자 페이지 (메인)
create.html             집 생성
event.html              이벤트 갤러리
share.html              초대장 랜딩

public/js/common.js     state, showToast, apiFetch, renderPost
public/js/api.js        loadHouseData, submitPost, deletePost
public/tabs/living.js   거실 렌더
public/tabs/room.js     방 렌더 + 반응/댓글
public/tabs/library.js  서재 렌더 + 스토리
public/js/features/
  write.js              글쓰기 모달 + 감정/분류
  guestbook.js          방명록
  onboarding.js         온보딩
public/js/core/
  upload.js             Cloudinary 업로드
  share.js              공유 엔진
public/css/
  layout.css            공통 레이아웃
  house.css             집 전용 스타일
```

---

## 6. 인증 방식

```js
// owner_key: URL ?owner=KEY 로 관리자 모드 판단
// device_id: localStorage cn_device_id
// state.isOwner = !!(house.is_owner)
```

---

## 7. Phase 1 보류 사항

- device_id 기반 RLS (RPC 함수)
- 관심/관계 시스템
- 온보딩 플로우 완성
- 계절별 시각 변화 (봄/여름/가을/겨울)
- 공유 UX 재설계
- DB 클린업: event_posts, event_likes, 미사용 컬럼

---

## 8. 세션 시작 체크리스트

```
□ 어떤 파일을 수정하는가?
□ API 추가 없이 action 파라미터로 해결 가능한가?
□ 풀소스 교체인가, 부분 패치인가?
□ DB 스키마 변경이 있는가? (GRANT 필요)
□ Vercel env 변경이 있는가? (Redeploy 필요)
```
