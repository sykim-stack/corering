// patch_seo_sharemodal.cjs
const fs = require('fs');
const path = 'components/ShareRoomModal.tsx';
let content = fs.readFileSync(path, 'utf8');
let changed = false;

// Patch A: interface에 roomId 추가
const ifaceBefore = [
  "interface ShareRoomModalProps {",
  "  roomCode: string;",
  "  onClose: () => void;",
  "}"
].join("\n");

const ifaceAfter = [
  "interface ShareRoomModalProps {",
  "  roomId: string;",
  "  roomCode: string;",
  "  onClose: () => void;",
  "}"
].join("\n");

if (content.includes(ifaceAfter)) {
  console.log('SKIP A: 이미 적용됨 (interface)');
} else if (content.includes(ifaceBefore)) {
  content = content.replace(ifaceBefore, ifaceAfter);
  changed = true;
  console.log('OK A: interface에 roomId 추가');
} else {
  console.log('X A: interface 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch B: 함수 시그니처
const fnBefore = "export default function ShareRoomModal({ roomCode, onClose }: ShareRoomModalProps) {";
const fnAfter = "export default function ShareRoomModal({ roomId, roomCode, onClose }: ShareRoomModalProps) {";

if (content.includes(fnAfter)) {
  console.log('SKIP B: 이미 적용됨 (함수 시그니처)');
} else if (content.includes(fnBefore)) {
  content = content.replace(fnBefore, fnAfter);
  changed = true;
  console.log('OK B: 함수 시그니처에 roomId 추가');
} else {
  console.log('X B: 함수 시그니처 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch C: shareUrl을 /rooms/{roomId}로 변경 (ADR-SEO-001)
const urlBefore = "    const shareUrl = 'https://corering.vercel.app?code=' + encodeURIComponent(roomCode);";
const urlAfter = "    const shareUrl = 'https://corering.vercel.app/rooms/' + roomId;";

if (content.includes(urlAfter)) {
  console.log('SKIP C: 이미 적용됨 (shareUrl)');
} else if (content.includes(urlBefore)) {
  content = content.replace(urlBefore, urlAfter);
  changed = true;
  console.log('OK C: shareUrl을 /rooms/{roomId}로 변경');
} else {
  console.log('X C: shareUrl 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (changed) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('=== ShareRoomModal.tsx 저장 완료 ===');
} else {
  console.log('=== 변경 사항 없음 (모두 이미 적용됨) ===');
}