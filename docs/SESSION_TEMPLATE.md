# 세션 시작 템플릿

## 빠른 시작 (복붙용)

### CoreNull 세션
```
오늘 작업: [작업 내용]
수정 파일: [파일명]
참고: raw.githubusercontent.com/sykim-stack/corenull/refs/heads/main/[파일명]
```

### 전체 컨텍스트 세션 (복잡한 작업)
```
[BRAINPOOL_CORE.md 첨부]
[CORENULL_SPEC.md 첨부]

오늘 작업: [작업 내용]
```

---

## 문서 첨부 가이드

| 작업 유형 | 첨부 문서 |
|-----------|-----------|
| 버그 수정 | 없음 (파일 URL만) |
| 기능 추가 | CORENULL_SPEC.md |
| 아키텍처 결정 | BRAINPOOL_CORE.md + CORENULL_SPEC.md |
| CoreRing 작업 | CORERING_SPEC.md |
| 신규 프로젝트 | BRAINPOOL_CORE.md |

---

## GitHub raw URL 패턴

```
https://raw.githubusercontent.com/sykim-stack/corenull/refs/heads/main/[파일경로]

예시:
- house.html
- public/js/common.js
- api/house.js
- public/tabs/room.js
```

---

## 자주 쓰는 컨텍스트 조각

### state 구조
```js
state = {
  slug, ownerKey, isOwner, houseId, houseData,
  rooms, categories, allMedia, allPosts,
  currentRoomId, activeCat
}
```

### API 호출 패턴
```js
// 헤더 필수
headers: {
  'Accept-Profile': 'corenull',
  'Content-Profile': 'corenull',
  'x-device-id': DEVICE_ID
}
```

### 이벤트 포스트 조회
```js
// ✅ 올바른 방법
const room = rooms.find(r => r.id === ROOM_ID);
const cat = categories.find(c => c.name === room?.room_name);
fetch(`/api/posts?house_id=${HOUSE_ID}&category_id=${cat?.id}`)

// ❌ 금지
fetch(`/api/posts?room_id=${ROOM_ID}`)
```
