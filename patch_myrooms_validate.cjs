// patch_myrooms_validate.cjs
const fs = require('fs');
const path = 'app/page.tsx';
let content = fs.readFileSync(path, 'utf8');
let changed = false;

// Patch: loadRooms 함수에 myRooms 검증 로직 추가
// 기존 loadRooms는 공개 방 목록만 불러왔는데, 여기에 myRooms 유효성 검증도 같이 처리
const anchor = [
  "  const loadRooms = useCallback(async () => {",
  "    const res = await fetch('/api/chat/rooms', {",
  "      headers: { 'x-device-id': deviceId },",
  "    }).catch(() => null);",
  "    if (!res) return;",
  "    const data = await res.json().catch(() => null);",
  "    if (data?.payload?.rooms) setRooms(data.payload.rooms);",
  "  }, [deviceId]);"
].join("\n");

const replacement = [
  "  const loadRooms = useCallback(async () => {",
  "    const res = await fetch('/api/chat/rooms', {",
  "      headers: { 'x-device-id': deviceId },",
  "    }).catch(() => null);",
  "    if (!res) return;",
  "    const data = await res.json().catch(() => null);",
  "    if (data?.payload?.rooms) setRooms(data.payload.rooms);",
  "  }, [deviceId]);",
  "",
  "  // myRooms(localStorage 캐시)에 남아있는 방이 실제로 삭제됐는지 조용히 검증하고 정리",
  "  const validateMyRooms = useCallback(async () => {",
  "    setMyRooms(prev => {",
  "      if (prev.length === 0) return prev;",
  "      (async () => {",
  "        const checks = await Promise.all(",
  "          prev.map(async (room) => {",
  "            const res = await fetch('/api/chat/rooms/' + room.roomId).catch(() => null);",
  "            if (!res || !res.ok) return null;",
  "            const data = await res.json().catch(() => null);",
  "            return data?.payload?.room ? room : null;",
  "          })",
  "        );",
  "        const alive = checks.filter(Boolean) as Room[];",
  "        if (alive.length !== prev.length) {",
  "          setMyRooms(alive);",
  "          localStorage.setItem('myRooms', JSON.stringify(alive));",
  "        }",
  "      })();",
  "      return prev;",
  "    });",
  "  }, []);"
].join("\n");

if (content.includes('validateMyRooms')) {
  console.log('SKIP 1: 이미 적용됨 (validateMyRooms 함수)');
} else if (content.includes(anchor)) {
  content = content.replace(anchor, replacement);
  changed = true;
  console.log('OK 1: validateMyRooms 함수 추가');
} else {
  console.log('X 1: loadRooms 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch 2: 마운트 시 validateMyRooms 호출
const useEffectAnchor = "  useEffect(() => { loadRooms(); }, [loadRooms]);";
const useEffectReplacement = [
  "  useEffect(() => { loadRooms(); }, [loadRooms]);",
  "  useEffect(() => { validateMyRooms(); }, [validateMyRooms]);"
].join("\n");

if (content.includes('useEffect(() => { validateMyRooms(); }')) {
  console.log('SKIP 2: 이미 적용됨 (validateMyRooms useEffect)');
} else if (content.includes(useEffectAnchor)) {
  content = content.replace(useEffectAnchor, useEffectReplacement);
  changed = true;
  console.log('OK 2: 마운트 시 validateMyRooms 호출 추가');
} else {
  console.log('X 2: useEffect(loadRooms) 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (changed) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('=== page.tsx 저장 완료 ===');
} else {
  console.log('=== 변경 사항 없음 (모두 이미 적용됨) ===');
}