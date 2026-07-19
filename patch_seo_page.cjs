// patch_seo_page.cjs
const fs = require('fs');
const path = 'app/page.tsx';
let content = fs.readFileSync(path, 'utf8');
let changed = false;

// Patch 1: Home 함수 시그니처에 initialRoomId prop 추가
const fnBefore = "export default function Home() {";
const fnAfter = "export default function Home({ initialRoomId }: { initialRoomId?: string } = {}) {";

if (content.includes(fnAfter)) {
  console.log('SKIP 1: 이미 적용됨 (Home 시그니처)');
} else if (content.includes(fnBefore)) {
  content = content.replace(fnBefore, fnAfter);
  changed = true;
  console.log('OK 1: Home({ initialRoomId }) prop 추가');
} else {
  console.log('X 1: Home 함수 시그니처 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch 2: shareRoomId state 추가
const stateBefore = "  const [shareRoomCode, setShareRoomCode] = useState<string | null>(null);";
const stateAfter = [
  "  const [shareRoomCode, setShareRoomCode] = useState<string | null>(null);",
  "  const [shareRoomId, setShareRoomId] = useState<string | null>(null);"
].join("\n");

if (content.includes(stateAfter)) {
  console.log('SKIP 2: 이미 적용됨 (shareRoomId state)');
} else if (content.includes(stateBefore)) {
  content = content.replace(stateBefore, stateAfter);
  changed = true;
  console.log('OK 2: shareRoomId state 추가');
} else {
  console.log('X 2: shareRoomCode state 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch 3: 방 생성 시 shareRoomId도 세팅
const createBefore = [
  "            setShareRoomCode(data.payload.room.inviteCode || null);",
  "            setIsRoomMode(false);"
].join("\n");

const createAfter = [
  "            setShareRoomCode(data.payload.room.inviteCode || null);",
  "            setShareRoomId(data.payload.room.roomId || null);",
  "            setIsRoomMode(false);"
].join("\n");

if (content.includes(createAfter)) {
  console.log('SKIP 3: 이미 적용됨 (onCreateRoom)');
} else if (content.includes(createBefore)) {
  content = content.replace(createBefore, createAfter);
  changed = true;
  console.log('OK 3: onCreateRoom에서 setShareRoomId 호출 추가');
} else {
  console.log('X 3: onCreateRoom 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch 4: 딥링크 useEffect를 initialRoomId 우선 처리로 교체 (ADR-SEO-001)
const effectBefore = [
  "  // -- URL 딥링크 처리 (초대링크 ?code=, 알림 ?room=) -----------------",
  "  useEffect(() => {",
  "  const params = new URLSearchParams(window.location.search);",
  "  const code = params.get('code');",
  "  const roomParam = params.get('room');",
  "",
  "  if (code) {",
  "    handleJoinByCode(code.toUpperCase());",
  "    window.history.replaceState({}, '', window.location.pathname);",
  "  } else if (roomParam) {",
  "    (async () => {",
  "      const res = await fetch(`/api/chat/rooms/${roomParam}`).catch(() => null);",
  "      const data = res ? await res.json().catch(() => null) : null;",
  "      if (data?.payload?.room) {",
  "        setMessages([]);",
  "        setCurrentRoomId(data.payload.room.roomId);",
  "        setCurrentRoomCode(data.payload.room.inviteCode || '------');",
  "        saveMyRoom(data.payload.room);",
  "      }",
  "      window.history.replaceState({}, '', window.location.pathname);",
  "    })();",
  "  }",
  "}, []); // eslint-disable-line react-hooks/exhaustive-deps"
].join("\n");

const effectAfter = [
  "  // -- URL 딥링크 처리 (초대링크 ?code=, 알림 ?room=, SEO /rooms/{id}) -----------------",
  "  useEffect(() => {",
  "  if (initialRoomId) {",
  "    (async () => {",
  "      const res = await fetch('/api/chat/rooms/' + initialRoomId).catch(() => null);",
  "      const data = res ? await res.json().catch(() => null) : null;",
  "      if (data?.payload?.room) {",
  "        setMessages([]);",
  "        setCurrentRoomId(data.payload.room.roomId);",
  "        setCurrentRoomCode(data.payload.room.inviteCode || '------');",
  "        saveMyRoom(data.payload.room);",
  "      }",
  "    })();",
  "    return;",
  "  }",
  "",
  "  const params = new URLSearchParams(window.location.search);",
  "  const code = params.get('code');",
  "  const roomParam = params.get('room');",
  "",
  "  if (code) {",
  "    handleJoinByCode(code.toUpperCase());",
  "    window.history.replaceState({}, '', window.location.pathname);",
  "  } else if (roomParam) {",
  "    (async () => {",
  "      const res = await fetch('/api/chat/rooms/' + roomParam).catch(() => null);",
  "      const data = res ? await res.json().catch(() => null) : null;",
  "      if (data?.payload?.room) {",
  "        setMessages([]);",
  "        setCurrentRoomId(data.payload.room.roomId);",
  "        setCurrentRoomCode(data.payload.room.inviteCode || '------');",
  "        saveMyRoom(data.payload.room);",
  "      }",
  "      window.history.replaceState({}, '', window.location.pathname);",
  "    })();",
  "  }",
  "}, [initialRoomId]); // eslint-disable-line react-hooks/exhaustive-deps"
].join("\n");

if (content.includes(effectAfter)) {
  console.log('SKIP 4: 이미 적용됨 (딥링크 useEffect)');
} else if (content.includes(effectBefore)) {
  content = content.replace(effectBefore, effectAfter);
  changed = true;
  console.log('OK 4: initialRoomId 우선 처리 useEffect로 교체');
} else {
  console.log('X 4: 딥링크 useEffect 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch 5: ShareRoomModal 렌더에 roomId 전달
const renderBefore = [
  "      {shareRoomCode && (",
  "        <ShareRoomModal",
  "          roomCode={shareRoomCode}",
  "          onClose={() => setShareRoomCode(null)}",
  "        />",
  "      )}"
].join("\n");

const renderAfter = [
  "      {shareRoomCode && shareRoomId && (",
  "        <ShareRoomModal",
  "          roomId={shareRoomId}",
  "          roomCode={shareRoomCode}",
  "          onClose={() => { setShareRoomCode(null); setShareRoomId(null); }}",
  "        />",
  "      )}"
].join("\n");

if (content.includes(renderAfter)) {
  console.log('SKIP 5: 이미 적용됨 (ShareRoomModal 렌더)');
} else if (content.includes(renderBefore)) {
  content = content.replace(renderBefore, renderAfter);
  changed = true;
  console.log('OK 5: ShareRoomModal에 roomId prop 전달');
} else {
  console.log('X 5: ShareRoomModal 렌더 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (changed) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('=== page.tsx 저장 완료 ===');
} else {
  console.log('=== 변경 사항 없음 (모두 이미 적용됨) ===');
}