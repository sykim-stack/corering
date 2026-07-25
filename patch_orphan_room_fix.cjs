// patch_orphan_room_fix.cjs
const fs = require('fs');

// ═══════════════════════════════════════════════════════
// Part 1: brain-engine/engines/chat/message.js
// sendMessage에 방 존재 여부 검증 추가
// ═══════════════════════════════════════════════════════
const msgPath = 'brain-engine/engines/chat/message.js';
let msgContent = fs.readFileSync(msgPath, 'utf8');
let msgChanged = false;

const sendBefore = [
  "async function sendMessage(ctx) {",
  "  const { roomId, userId, original, meta = {} } = ctx.payload || {};",
  "  if (!roomId || !userId || !original) return { ...ctx, _error: 'roomId, userId, original required' };",
  "  if (!isUUID(roomId)) return { ...ctx, _error: 'roomId is not UUID: ' + roomId };",
  "  const db = await getStorage();",
  "  if (!db) return { ...ctx, _error: 'DB connection failed' };"
].join("\n");

const sendAfter = [
  "async function sendMessage(ctx) {",
  "  const { roomId, userId, original, meta = {} } = ctx.payload || {};",
  "  if (!roomId || !userId || !original) return { ...ctx, _error: 'roomId, userId, original required' };",
  "  if (!isUUID(roomId)) return { ...ctx, _error: 'roomId is not UUID: ' + roomId };",
  "  const db = await getStorage();",
  "  if (!db) return { ...ctx, _error: 'DB connection failed' };",
  "",
  "  // 방이 실제로 존재하는지 확인 (삭제된 방에 고아 메시지가 쌓이는 것 방지)",
  "  const { data: roomCheck } = await db.from('chat_rooms').select('id').eq('id', roomId).maybeSingle();",
  "  if (!roomCheck) return { ...ctx, _error: 'ROOM_DELETED', roomDeleted: true };"
].join("\n");

if (msgContent.includes('ROOM_DELETED')) {
  console.log('SKIP 1: 이미 적용됨 (sendMessage 방 존재 검증)');
} else if (msgContent.includes(sendBefore)) {
  msgContent = msgContent.replace(sendBefore, sendAfter);
  msgChanged = true;
  console.log('OK 1: sendMessage에 방 존재 검증 추가');
} else {
  console.log('X 1: sendMessage 앵커 못 찾음 - 중단');
  process.exit(1);
}

const historyBefore = [
  "async function getHistory(ctx) {",
  "  const { roomId, limit = 50 } = ctx.payload || {};",
  "  if (!roomId) return { ...ctx, _error: 'roomId required' };",
  "  const db = await getStorage();",
  "  if (!db) return { ...ctx, _error: 'DB connection failed' };",
  "  const { data, error } = await db.from('messages')"
].join("\n");

const historyAfter = [
  "async function getHistory(ctx) {",
  "  const { roomId, limit = 50 } = ctx.payload || {};",
  "  if (!roomId) return { ...ctx, _error: 'roomId required' };",
  "  const db = await getStorage();",
  "  if (!db) return { ...ctx, _error: 'DB connection failed' };",
  "",
  "  // 폴링 시에도 방이 삭제됐는지 확인해서 프론트에 알려줌",
  "  const { data: roomCheck } = await db.from('chat_rooms').select('id').eq('id', roomId).maybeSingle();",
  "  if (!roomCheck) return { ...ctx, _error: 'ROOM_DELETED', roomDeleted: true };",
  "",
  "  const { data, error } = await db.from('messages')"
].join("\n");

if (msgContent.includes("폴링 시에도 방이 삭제됐는지")) {
  console.log('SKIP 2: 이미 적용됨 (getHistory 방 존재 검증)');
} else if (msgContent.includes(historyBefore)) {
  msgContent = msgContent.replace(historyBefore, historyAfter);
  msgChanged = true;
  console.log('OK 2: getHistory에 방 존재 검증 추가 (폴링 시 감지)');
} else {
  console.log('X 2: getHistory 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (msgChanged) {
  fs.writeFileSync(msgPath, msgContent, 'utf8');
  console.log('=== message.js 저장 완료 ===');
}

// ═══════════════════════════════════════════════════════
// Part 2: app/api/chat/route.ts
// ROOM_DELETED 에러를 프론트가 구분할 수 있게 응답 형식 유지 확인
// (send/poll 액션은 이미 result._error를 그대로 전달하므로 코드 변경 불필요)
// → 별도 패치 없음, page.tsx만 수정
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// Part 3: app/page.tsx
// 폴링/전송 응답에서 ROOM_DELETED 감지 시 자동 퇴장 + 안내
// ═══════════════════════════════════════════════════════
const pagePath = 'app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');
let pageChanged = false;

// Patch A: 폴링 함수에서 ROOM_DELETED 감지
const pollBefore = [
  "        if (cancelled || !res || !res.ok) return;",
  "",
  "        const data = await res.json().catch(() => null);",
  "        if (cancelled || !data) return;",
  "",
  "        const rawMsgs = data.payload?.messages || [];"
].join("\n");

const pollAfter = [
  "        if (cancelled || !res || !res.ok) return;",
  "",
  "        const data = await res.json().catch(() => null);",
  "        if (cancelled || !data) return;",
  "",
  "        if (data._error === 'ROOM_DELETED') {",
  "          alert('이 방은 삭제되었습니다.');",
  "          handleExitRoom();",
  "          return;",
  "        }",
  "",
  "        const rawMsgs = data.payload?.messages || [];"
].join("\n");

if (pageContent.includes("이 방은 삭제되었습니다")) {
  console.log('SKIP 3: 이미 적용됨 (폴링 ROOM_DELETED 감지)');
} else if (pageContent.includes(pollBefore)) {
  pageContent = pageContent.replace(pollBefore, pollAfter);
  pageChanged = true;
  console.log('OK 3: 폴링에서 ROOM_DELETED 감지 시 자동 퇴장 추가');
} else {
  console.log('X 3: 폴링 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch B: sendMessageToRoom에서도 ROOM_DELETED 감지
const sendRoomBefore = [
  "  const sendMessageToRoom = async (roomId: string, text: string) => {",
  "    await fetch('/api/chat', {",
  "      method: 'POST',",
  "      headers: { 'Content-Type': 'application/json; charset=utf-8' },",
  "      body: JSON.stringify({ action: 'send', roomId, userId: deviceId, original: text, analyze: true }),",
  "    }).catch(err => console.error('메시지 전송 실패:', err));",
  "  };"
].join("\n");

const sendRoomAfter = [
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

if (pageContent.includes("const sendMessageToRoom = async (roomId: string, text: string) => {\n    const res = await fetch")) {
  console.log('SKIP 4: 이미 적용됨 (sendMessageToRoom ROOM_DELETED 감지)');
} else if (pageContent.includes(sendRoomBefore)) {
  pageContent = pageContent.replace(sendRoomBefore, sendRoomAfter);
  pageChanged = true;
  console.log('OK 4: sendMessageToRoom에서 ROOM_DELETED 감지 추가');
} else {
  console.log('X 4: sendMessageToRoom 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (pageChanged) {
  fs.writeFileSync(pagePath, pageContent, 'utf8');
  console.log('=== page.tsx 저장 완료 ===');
}

console.log('');
console.log('참고: handleExitRoom은 이미 useCallback([])로 정의되어 있어 poll/send 함수보다');
console.log('먼저 선언되어야 합니다. 만약 빌드 에러(참조 순서) 발생 시 알려주세요.');