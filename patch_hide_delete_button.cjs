// patch_hide_delete_button.cjs
const fs = require('fs');

// ═══════════════════════════════════════════════════════
// Part 1: brain-engine/engines/chat/room.js
// listRooms / createRoom 응답에 ownerDeviceId 포함
// ═══════════════════════════════════════════════════════
const roomPath = 'brain-engine/engines/chat/room.js';
let roomContent = fs.readFileSync(roomPath, 'utf8');
let roomChanged = false;

// createRoom 반환값에 ownerDeviceId 추가
const createAnchor = "return { ...ctx, room: { roomId: data.id, inviteCode: data.invite_code, title: data.room_name, status: 'active', createdBy, createdAt: data.created_at, updatedAt: data.created_at, messageCount: 0, participantCount: 1, maxParticipants, tags } };";
const createReplacement = "return { ...ctx, room: { roomId: data.id, inviteCode: data.invite_code, title: data.room_name, status: 'active', createdBy, ownerDeviceId: data.owner_device_id, createdAt: data.created_at, updatedAt: data.created_at, messageCount: 0, participantCount: 1, maxParticipants, tags } };";

if (roomContent.includes('ownerDeviceId: data.owner_device_id, createdAt: data.created_at, updatedAt: data.created_at, messageCount: 0, participantCount: 1, maxParticipants, tags } };\n}\n\nasync function getRoom')) {
  console.log('SKIP 1a: 이미 적용됨 (createRoom ownerDeviceId)');
} else if (roomContent.includes(createAnchor)) {
  roomContent = roomContent.replace(createAnchor, createReplacement);
  roomChanged = true;
  console.log('OK 1a: createRoom 응답에 ownerDeviceId 추가');
} else {
  console.log('X 1a: createRoom 앵커 못 찾음 - 중단');
  process.exit(1);
}

// listRooms 반환값에 ownerDeviceId 추가
const listAnchor = "return { ...ctx, rooms: (data || []).map(r => ({ roomId: r.id, inviteCode: r.invite_code, title: r.room_name, status: 'active', createdBy: r.metadata?.createdBy || 'anonymous', createdAt: r.created_at, updatedAt: r.created_at, messageCount: r.metadata?.messageCount || 0, participantCount: 0, maxParticipants: r.metadata?.maxParticipants || 100, tags: r.metadata?.tags || [] })) };";
const listReplacement = "return { ...ctx, rooms: (data || []).map(r => ({ roomId: r.id, inviteCode: r.invite_code, title: r.room_name, status: 'active', createdBy: r.metadata?.createdBy || 'anonymous', ownerDeviceId: r.owner_device_id, createdAt: r.created_at, updatedAt: r.created_at, messageCount: r.metadata?.messageCount || 0, participantCount: 0, maxParticipants: r.metadata?.maxParticipants || 100, tags: r.metadata?.tags || [] })) };";

if (roomContent.includes('ownerDeviceId: r.owner_device_id')) {
  console.log('SKIP 1b: 이미 적용됨 (listRooms ownerDeviceId)');
} else if (roomContent.includes(listAnchor)) {
  roomContent = roomContent.replace(listAnchor, listReplacement);
  roomChanged = true;
  console.log('OK 1b: listRooms 응답에 ownerDeviceId 추가');
} else {
  console.log('X 1b: listRooms 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (roomChanged) {
  fs.writeFileSync(roomPath, roomContent, 'utf8');
  console.log('=== room.js 저장 완료 ===');
}

// ═══════════════════════════════════════════════════════
// Part 2: app/page.tsx
// Room 인터페이스에 ownerDeviceId 추가, saveMyRoom은 그대로 room 객체 저장하므로 자동 포함
// ═══════════════════════════════════════════════════════
const pagePath = 'app/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');
let pageChanged = false;

const roomInterfaceAnchor = [
  "interface Room {",
  "  roomId: string;",
  "  title: string;",
  "  inviteCode?: string;",
  "  messageCount?: number;",
  "  isPublic?: boolean;",
  "}"
].join("\n");

const roomInterfaceReplacement = [
  "interface Room {",
  "  roomId: string;",
  "  title: string;",
  "  inviteCode?: string;",
  "  messageCount?: number;",
  "  isPublic?: boolean;",
  "  ownerDeviceId?: string;",
  "}"
].join("\n");

if (pageContent.includes('ownerDeviceId?: string;')) {
  console.log('SKIP 2: 이미 적용됨 (Room interface ownerDeviceId)');
} else if (pageContent.includes(roomInterfaceAnchor)) {
  pageContent = pageContent.replace(roomInterfaceAnchor, roomInterfaceReplacement);
  pageChanged = true;
  console.log('OK 2: Room 인터페이스에 ownerDeviceId 추가');
} else {
  console.log('X 2: Room interface 앵커 못 찾음 - 중단');
  process.exit(1);
}

// RoomList에 deviceId prop 전달
const roomListAnchor = [
  "      <RoomList",
  "        rooms={rooms}",
  "        myRooms={myRooms}"
].join("\n");

const roomListReplacement = [
  "      <RoomList",
  "        rooms={rooms}",
  "        myRooms={myRooms}",
  "        deviceId={deviceId}"
].join("\n");

if (pageContent.includes('deviceId={deviceId}')) {
  console.log('SKIP 3: 이미 적용됨 (RoomList deviceId prop)');
} else if (pageContent.includes(roomListAnchor)) {
  pageContent = pageContent.replace(roomListAnchor, roomListReplacement);
  pageChanged = true;
  console.log('OK 3: RoomList에 deviceId prop 전달');
} else {
  console.log('X 3: RoomList 렌더 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (pageChanged) {
  fs.writeFileSync(pagePath, pageContent, 'utf8');
  console.log('=== page.tsx 저장 완료 ===');
}

// ═══════════════════════════════════════════════════════
// Part 3: components/RoomList.tsx
// deviceId prop 추가, 본인 소유 방만 삭제 버튼 표시
// ═══════════════════════════════════════════════════════
const roomListPath = 'components/RoomList.tsx';
let roomListContent = fs.readFileSync(roomListPath, 'utf8');
let roomListChanged = false;

// Room 인터페이스에 ownerDeviceId 추가
const rlInterfaceAnchor = [
  "interface Room {",
  "  roomId: string;",
  "  title: string;",
  "  inviteCode?: string;",
  "  messageCount?: number;",
  "  isPublic?: boolean;",
  "}"
].join("\n");

const rlInterfaceReplacement = [
  "interface Room {",
  "  roomId: string;",
  "  title: string;",
  "  inviteCode?: string;",
  "  messageCount?: number;",
  "  isPublic?: boolean;",
  "  ownerDeviceId?: string;",
  "}"
].join("\n");

if (roomListContent.includes('ownerDeviceId?: string;')) {
  console.log('SKIP 4: 이미 적용됨 (RoomList.tsx Room interface)');
} else if (roomListContent.includes(rlInterfaceAnchor)) {
  roomListContent = roomListContent.replace(rlInterfaceAnchor, rlInterfaceReplacement);
  roomListChanged = true;
  console.log('OK 4: RoomList.tsx Room 인터페이스에 ownerDeviceId 추가');
} else {
  console.log('X 4: RoomList.tsx Room interface 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Props 인터페이스에 deviceId 추가
const propsAnchor = [
  "interface RoomListProps {",
  "  rooms: Room[];",
  "  myRooms?: Room[];"
].join("\n");

const propsReplacement = [
  "interface RoomListProps {",
  "  rooms: Room[];",
  "  myRooms?: Room[];",
  "  deviceId?: string;"
].join("\n");

if (roomListContent.includes('deviceId?: string;')) {
  console.log('SKIP 5: 이미 적용됨 (RoomListProps deviceId)');
} else if (roomListContent.includes(propsAnchor)) {
  roomListContent = roomListContent.replace(propsAnchor, propsReplacement);
  roomListChanged = true;
  console.log('OK 5: RoomListProps에 deviceId 추가');
} else {
  console.log('X 5: RoomListProps 앵커 못 찾음 - 중단');
  process.exit(1);
}

// 함수 시그니처에 deviceId 추가
const fnSigAnchor = "export default function RoomList({ rooms, myRooms = [], onSelectRoom, onCreateRoom, onJoinByCode, onDeleteRoom, visible }: RoomListProps) {";
const fnSigReplacement = "export default function RoomList({ rooms, myRooms = [], onSelectRoom, onCreateRoom, onJoinByCode, onDeleteRoom, visible, deviceId }: RoomListProps) {";

if (roomListContent.includes(', visible, deviceId }: RoomListProps) {')) {
  console.log('SKIP 6: 이미 적용됨 (함수 시그니처 deviceId)');
} else if (roomListContent.includes(fnSigAnchor)) {
  roomListContent = roomListContent.replace(fnSigAnchor, fnSigReplacement);
  roomListChanged = true;
  console.log('OK 6: 함수 시그니처에 deviceId 추가');
} else {
  console.log('X 6: 함수 시그니처 앵커 못 찾음 - 중단');
  process.exit(1);
}

// "내가 참여한 방" 목록의 삭제 버튼 조건부 렌더링
const myRoomBtnAnchor = [
  "                <button",
  "                  className={styles.deleteBtn}",
  "                  onClick={(e) => { e.stopPropagation(); onDeleteRoom(room.roomId); }}",
  "                >",
  "                  삭제",
  "                </button>",
  "              </div>",
  "            ))}",
  "          </>",
  "        )}"
].join("\n");

const myRoomBtnReplacement = [
  "                {room.ownerDeviceId === deviceId && (",
  "                  <button",
  "                    className={styles.deleteBtn}",
  "                    onClick={(e) => { e.stopPropagation(); onDeleteRoom(room.roomId); }}",
  "                  >",
  "                    삭제",
  "                  </button>",
  "                )}",
  "              </div>",
  "            ))}",
  "          </>",
  "        )}"
].join("\n");

if (roomListContent.includes('{room.ownerDeviceId === deviceId && (')) {
  console.log('SKIP 7: 이미 적용됨 (myRooms 삭제 버튼 조건부)');
} else if (roomListContent.includes(myRoomBtnAnchor)) {
  roomListContent = roomListContent.replace(myRoomBtnAnchor, myRoomBtnReplacement);
  roomListChanged = true;
  console.log('OK 7: 내가 참여한 방 목록의 삭제 버튼 조건부 렌더링 적용');
} else {
  console.log('X 7: myRooms 삭제 버튼 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (roomListChanged) {
  fs.writeFileSync(roomListPath, roomListContent, 'utf8');
  console.log('=== RoomList.tsx 저장 완료 ===');
}

console.log('');
console.log('참고: 공개 방 목록(rooms) 하단의 삭제 버튼은 그대로 두었습니다.');
console.log('공개 방 목록은 서버가 별도로 owner 여부를 안 내려주는 목록이라,');
console.log('일단 "내가 참여한 방(myRooms)" 목록만 우선 처리했습니다.');
console.log('공개 방 목록에서도 방장 판별이 필요하면 알려주세요.');