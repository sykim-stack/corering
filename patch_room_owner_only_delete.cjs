// patch_room_owner_only_delete.cjs
const fs = require('fs');

// ═══════════════════════════════════════════════════════
// Part 1: brain-engine/engines/chat/room.js
// deleteRoom에 소유자 검증 추가
// ═══════════════════════════════════════════════════════
const roomPath = 'brain-engine/engines/chat/room.js';
let roomContent = fs.readFileSync(roomPath, 'utf8');
let roomChanged = false;

const deleteAnchor = "async function deleteRoom(ctx) {\n  const { roomId } = ctx.payload || {};\n  const supabase = await getStorage();\n  if (!supabase) return { ...ctx, _error: 'DB connection failed' };\n  const { error } = await supabase.from('chat_rooms').delete().eq('id', roomId);";

const deleteReplacement = [
  "async function deleteRoom(ctx) {",
  "  const { roomId, deviceId } = ctx.payload || {};",
  "  const supabase = await getStorage();",
  "  if (!supabase) return { ...ctx, _error: 'DB connection failed' };",
  "",
  "  // 방장(owner_device_id)만 삭제 가능하도록 검증",
  "  const { data: existing, error: fetchError } = await supabase",
  "    .from('chat_rooms').select('owner_device_id').eq('id', roomId).maybeSingle();",
  "  if (fetchError) return { ...ctx, _error: fetchError.message };",
  "  if (!existing) return { ...ctx, _error: 'Room not found: ' + roomId };",
  "  if (!deviceId || existing.owner_device_id !== deviceId) {",
  "    return { ...ctx, _error: 'FORBIDDEN: 방장만 삭제할 수 있습니다.' };",
  "  }",
  "",
  "  const { error } = await supabase.from('chat_rooms').delete().eq('id', roomId);"
].join("\n");

if (roomContent.includes('방장만 삭제할 수 있습니다')) {
  console.log('SKIP 1: 이미 적용됨 (room.js deleteRoom 검증)');
} else if (roomContent.includes(deleteAnchor)) {
  roomContent = roomContent.replace(deleteAnchor, deleteReplacement);
  roomChanged = true;
  console.log('OK 1: deleteRoom에 방장 검증 추가');
} else {
  console.log('X 1: deleteRoom 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (roomChanged) {
  fs.writeFileSync(roomPath, roomContent, 'utf8');
  console.log('=== room.js 저장 완료 ===');
}

// ═══════════════════════════════════════════════════════
// Part 2: app/api/chat/rooms/[roomId]/route.ts
// DELETE 핸들러에서 deviceId 받아서 전달
// ═══════════════════════════════════════════════════════
const routePath = 'app/api/chat/rooms/[roomId]/route.ts';
let routeContent = fs.readFileSync(routePath, 'utf8');
let routeChanged = false;

const routeAnchor = [
  "export async function DELETE(",
  "  request: NextRequest,",
  "  { params }: { params: Promise<{ roomId: string }> }",
  ") {",
  "  const traceId = crypto.randomUUID();",
  "  const { roomId } = await params;",
  "",
  "  try {",
  "    const { ChatRoomEngine } = await import('@/brain-engine/engines/chat/room.js');",
  "    const result: any = await ChatRoomEngine({",
  "      type:    'DELETE_ROOM',",
  "      payload: { roomId },"
].join("\n");

const routeReplacement = [
  "export async function DELETE(",
  "  request: NextRequest,",
  "  { params }: { params: Promise<{ roomId: string }> }",
  ") {",
  "  const traceId = crypto.randomUUID();",
  "  const { roomId } = await params;",
  "  const deviceId = request.headers.get('x-device-id') || '';",
  "",
  "  try {",
  "    const { ChatRoomEngine } = await import('@/brain-engine/engines/chat/room.js');",
  "    const result: any = await ChatRoomEngine({",
  "      type:    'DELETE_ROOM',",
  "      payload: { roomId, deviceId },"
].join("\n");

if (routeContent.includes("const deviceId = request.headers.get('x-device-id')")) {
  console.log('SKIP 2: 이미 적용됨 (route.ts deviceId 전달)');
} else if (routeContent.includes(routeAnchor)) {
  routeContent = routeContent.replace(routeAnchor, routeReplacement);
  routeChanged = true;
  console.log('OK 2: DELETE 핸들러에서 deviceId 헤더 전달 추가');
} else {
  console.log('X 2: DELETE 핸들러 앵커 못 찾음 - 중단');
  process.exit(1);
}

// 에러 상태 코드도 403으로 구분 (FORBIDDEN일 때)
const errorAnchor = [
  "    if (result._error) {",
  "      return NextResponse.json(",
  "        { payload: null, _error: result._error, traceId },",
  "        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }",
  "      );",
  "    }",
  "",
  "    return NextResponse.json(",
  "      { payload: { deleted: true }, _error: null, traceId },"
].join("\n");

const errorReplacement = [
  "    if (result._error) {",
  "      const status = String(result._error).startsWith('FORBIDDEN') ? 403 : 500;",
  "      return NextResponse.json(",
  "        { payload: null, _error: result._error, traceId },",
  "        { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }",
  "      );",
  "    }",
  "",
  "    return NextResponse.json(",
  "      { payload: { deleted: true }, _error: null, traceId },"
].join("\n");

if (routeContent.includes("startsWith('FORBIDDEN')")) {
  console.log('SKIP 3: 이미 적용됨 (403 상태코드 분기)');
} else if (routeContent.includes(errorAnchor)) {
  routeContent = routeContent.replace(errorAnchor, errorReplacement);
  routeChanged = true;
  console.log('OK 3: FORBIDDEN 에러 시 403 상태코드 분기 추가');
} else {
  console.log('X 3: 에러 응답 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (routeChanged) {
  fs.writeFileSync(routePath, routeContent, 'utf8');
  console.log('=== [roomId]/route.ts 저장 완료 ===');
}

// ═══════════════════════════════════════════════════════
// Part 3: app/page.tsx
// handleDeleteRoom에서 x-device-id 헤더 전송
// ═══════════════════════════════════════════════════════
const pagePath = 'app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');
let pageChanged = false;

const handleDeleteAnchor = "    const res = await fetch(`/api/chat/rooms/${roomId}`, {\n      method: 'DELETE',\n    }).catch(() => null);";

const handleDeleteReplacement = [
  "    const res = await fetch(`/api/chat/rooms/${roomId}`, {",
  "      method: 'DELETE',",
  "      headers: { 'x-device-id': deviceId },",
  "    }).catch(() => null);"
].join("\n");

if (pageContent.includes("headers: { 'x-device-id': deviceId },\n    }).catch(() => null);\n    const data = res ? await res.json().catch(() => null) : null;\n    if (data?.payload?.deleted)")) {
  console.log('SKIP 4: 이미 적용됨 (handleDeleteRoom deviceId 헤더)');
} else if (pageContent.includes(handleDeleteAnchor)) {
  pageContent = pageContent.replace(handleDeleteAnchor, handleDeleteReplacement);
  pageChanged = true;
  console.log('OK 4: handleDeleteRoom에서 deviceId 헤더 전송 추가');
} else {
  console.log('X 4: handleDeleteRoom 앵커 못 찾음 - 중단');
  process.exit(1);
}

// 삭제 실패 시(FORBIDDEN) 사용자 안내 추가
const deleteFailAnchor = [
  "    const data = res ? await res.json().catch(() => null) : null;",
  "    if (data?.payload?.deleted) {",
  "      setMyRooms(prev => {",
  "        const updated = prev.filter(r => r.roomId !== roomId);",
  "        localStorage.setItem('myRooms', JSON.stringify(updated));",
  "        return updated;",
  "      });",
  "      loadRooms();",
  "    }",
  "  }, [loadRooms]);"
].join("\n");

const deleteFailReplacement = [
  "    const data = res ? await res.json().catch(() => null) : null;",
  "    if (data?.payload?.deleted) {",
  "      setMyRooms(prev => {",
  "        const updated = prev.filter(r => r.roomId !== roomId);",
  "        localStorage.setItem('myRooms', JSON.stringify(updated));",
  "        return updated;",
  "      });",
  "      loadRooms();",
  "    } else if (String(data?._error || '').startsWith('FORBIDDEN')) {",
  "      alert('방장만 삭제할 수 있어요.');",
  "    }",
  "  }, [loadRooms]);"
].join("\n");

if (pageContent.includes('방장만 삭제할 수 있어요')) {
  console.log('SKIP 5: 이미 적용됨 (삭제 실패 안내)');
} else if (pageContent.includes(deleteFailAnchor)) {
  pageContent = pageContent.replace(deleteFailAnchor, deleteFailReplacement);
  pageChanged = true;
  console.log('OK 5: 삭제 권한 없을 시 안내 메시지 추가');
} else {
  console.log('X 5: handleDeleteRoom 끝부분 앵커 못 찾음 - 중단');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════
// Part 4: RoomList에 isOwner 정보 전달 (myRooms에 owner_device_id 필요)
// → onCreateRoom/onSelectRoom에서 room 객체에 ownerDeviceId가 없으면
//   삭제 버튼은 방장 판단이 불가능하므로, 우선 서버 검증만으로 방어.
//   (버튼 자체를 숨기는 건 별도 작업으로 분리 — 서버 거부만으로도 데이터는 안전함)
// ═══════════════════════════════════════════════════════

if (pageChanged) {
  fs.writeFileSync(pagePath, pageContent, 'utf8');
  console.log('=== page.tsx 저장 완료 ===');
}

console.log('');
console.log('참고: 이번 패치는 서버 측 권한 검증(핵심)까지만 적용합니다.');
console.log('프론트에서 "삭제" 버튼 자체를 방장에게만 보이게 숨기는 UI 작업은');
console.log('RoomList.tsx에 ownerDeviceId 정보가 필요해 별도 작업으로 분리했습니다.');
console.log('지금 패치만으로도 초대받은 사람이 버튼을 눌러도 서버가 거부하므로 안전합니다.');