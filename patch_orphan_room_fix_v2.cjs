// patch_orphan_room_fix_v2.cjs
const fs = require('fs');

// ═══════════════════════════════════════════════════════
// Part 1: brain-engine/engines/chat/message.js
// ═══════════════════════════════════════════════════════
const msgPath = 'brain-engine/engines/chat/message.js';
let msgContent = fs.readFileSync(msgPath, 'utf8');
let msgChanged = false;

// 짧은 단일 라인 앵커 사용 (줄바꿈 문제 회피)
const sendAnchor = "  if (!db) return { ...ctx, _error: 'DB connection failed' };";
const sendInsert = [
  "  if (!db) return { ...ctx, _error: 'DB connection failed' };",
  "  const { data: roomCheck } = await db.from('chat_rooms').select('id').eq('id', roomId).maybeSingle();",
  "  if (!roomCheck) return { ...ctx, _error: 'ROOM_DELETED', roomDeleted: true };"
].join("\n");

if (msgContent.includes('ROOM_DELETED')) {
  console.log('SKIP 1: 이미 적용됨 (message.js 방 존재 검증)');
} else {
  // 첫 번째 등장(=sendMessage 안)만 교체
  const firstIdx = msgContent.indexOf(sendAnchor);
  if (firstIdx === -1) {
    console.log('X 1: sendAnchor 자체를 못 찾음');
    console.log('--- 진단: DB connection failed 문자열이 파일에 있는지 ---');
    console.log(msgContent.includes('DB connection failed'));
    process.exit(1);
  }
  msgContent =
    msgContent.slice(0, firstIdx) +
    sendInsert +
    msgContent.slice(firstIdx + sendAnchor.length);
  msgChanged = true;
  console.log('OK 1: sendMessage에 방 존재 검증 추가 (첫 번째 매칭 지점)');

  // 두 번째 등장(=getHistory 안)을 찾아서 교체
  const secondIdx = msgContent.indexOf(sendAnchor);
  if (secondIdx === -1) {
    console.log('X 2: getHistory의 DB connection failed 앵커 못 찾음 (이미 소진됐을 수 있음)');
    process.exit(1);
  }
  msgContent =
    msgContent.slice(0, secondIdx) +
    sendInsert.replace('roomCheck } = await db', 'roomCheck2 } = await db').replace('!roomCheck)', '!roomCheck2)') +
    msgContent.slice(secondIdx + sendAnchor.length);
  console.log('OK 2: getHistory에 방 존재 검증 추가 (두 번째 매칭 지점)');
}

if (msgChanged) {
  fs.writeFileSync(msgPath, msgContent, 'utf8');
  console.log('=== message.js 저장 완료 ===');
}

// ═══════════════════════════════════════════════════════
// Part 2: app/page.tsx
// ═══════════════════════════════════════════════════════
const pagePath = 'app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');
let pageChanged = false;

// Patch A: 폴링에서 ROOM_DELETED 감지 — 짧은 단일 라인 앵커
const pollAnchor = "        const rawMsgs = data.payload?.messages || [];";
const pollInsert = [
  "        if (data._error === 'ROOM_DELETED') {",
  "          alert('이 방은 삭제되었습니다.');",
  "          handleExitRoom();",
  "          return;",
  "        }",
  "        const rawMsgs = data.payload?.messages || [];"
].join("\n");

if (pageContent.includes("이 방은 삭제되었습니다")) {
  console.log('SKIP 3: 이미 적용됨 (폴링 ROOM_DELETED 감지)');
} else if (pageContent.includes(pollAnchor)) {
  pageContent = pageContent.replace(pollAnchor, pollInsert);
  pageChanged = true;
  console.log('OK 3: 폴링에서 ROOM_DELETED 감지 추가');
} else {
  console.log('X 3: pollAnchor 못 찾음');
  process.exit(1);
}

// Patch B: sendMessageToRoom 함수 전체를 새 버전으로 교체
const sendRoomAnchor = "  const sendMessageToRoom = async (roomId: string, text: string) => {";

if (pageContent.includes("data?._error === 'ROOM_DELETED'")) {
  console.log('SKIP 4: 이미 적용됨 (sendMessageToRoom ROOM_DELETED 감지)');
} else if (pageContent.includes(sendRoomAnchor)) {
  // 함수 시작 지점부터 다음 "};"까지 찾아서 통째로 교체
  const startIdx = pageContent.indexOf(sendRoomAnchor);
  const endIdx = pageContent.indexOf("};", startIdx) + 2;
  const newFn = [
    "  const sendMessageToRoom = async (roomId: string, text: string) => {",
    "    const res = await fetch('/api/chat', {",
    "      method: 'POST',",
    "      headers: { 'Content-Type': 'application/json; charset=utf-8' },",
    "      body: JSON.stringify({ action: 'send', roomId, userId: deviceId, original: text, analyze: true }),",
    "    }).catch(err => { console.error('메시지 전송 실패:', err); return null; });",
    "    const data = res ? await res.json().catch(() => null) : null;",
    "    if (data?._error === 'ROOM_DELETED') {",
    "      alert('이 방은 삭제되었습니다.');",
    "      handleExitRoom();",
    "    }",
    "  };"
  ].join("\n");
  pageContent = pageContent.slice(0, startIdx) + newFn + pageContent.slice(endIdx);
  pageChanged = true;
  console.log('OK 4: sendMessageToRoom 함수 교체 완료');
} else {
  console.log('X 4: sendRoomAnchor 못 찾음');
  process.exit(1);
}

if (pageChanged) {
  fs.writeFileSync(pagePath, pageContent, 'utf8');
  console.log('=== page.tsx 저장 완료 ===');
}