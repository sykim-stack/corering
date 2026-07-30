// patch_device_id_migration.cjs
const fs = require('fs');
const path = 'app/page.tsx';
let content = fs.readFileSync(path, 'utf8');
let changed = false;

// Patch 1: getDeviceId 함수를 useEffect-safe 패턴으로 교체
// - 기존 키(deviceId)에서 신규 키(corering_device_id)로 마이그레이션
// - SSR에서는 빈 문자열 반환, 클라이언트에서만 실제 값 채움
const before = [
  "// ── device_id ────────────────────────────────────────────────────────",
  "const getDeviceId = () => {",
  "  if (typeof window === 'undefined') return 'anonymous';",
  "  let id = localStorage.getItem('deviceId');",
  "  if (!id) {",
  "    id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;",
  "    localStorage.setItem('deviceId', id);",
  "  }",
  "  return id;",
  "};"
].join("\n");

const after = [
  "// ── device_id ────────────────────────────────────────────────────────",
  "// CoreNull 패턴 준수: localStorage 접근은 useEffect 안에서만 수행 (SSR 하이드레이션 불일치 방지)",
  "// 기존 키('deviceId')에 값이 있으면 신규 키('corering_device_id')로 마이그레이션하여 유지",
  "const DEVICE_ID_KEY = 'corering_device_id';",
  "const LEGACY_DEVICE_ID_KEY = 'deviceId';",
  "",
  "function readOrCreateDeviceId(): string {",
  "  const existing = localStorage.getItem(DEVICE_ID_KEY);",
  "  if (existing) return existing;",
  "",
  "  const legacy = localStorage.getItem(LEGACY_DEVICE_ID_KEY);",
  "  if (legacy) {",
  "    localStorage.setItem(DEVICE_ID_KEY, legacy);",
  "    return legacy;",
  "  }",
  "",
  "  const fresh = crypto.randomUUID();",
  "  localStorage.setItem(DEVICE_ID_KEY, fresh);",
  "  return fresh;",
  "}"
].join("\n");

if (content.includes('DEVICE_ID_KEY = ')) {
  console.log('SKIP 1: 이미 적용됨 (getDeviceId 함수 교체)');
} else if (content.includes(before)) {
  content = content.replace(before, after);
  changed = true;
  console.log('OK 1: getDeviceId를 useEffect-safe 마이그레이션 패턴으로 교체');
} else {
  console.log('X 1: getDeviceId 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch 2: useState(getDeviceId) → useState('')로 변경, useEffect로 실제 값 채우기
const stateBefore = "  const [deviceId]                          = useState(getDeviceId);";
const stateAfter = [
  "  const [deviceId, setDeviceId]              = useState('');"
].join("\n");

if (content.includes("const [deviceId, setDeviceId]              = useState('');")) {
  console.log('SKIP 2: 이미 적용됨 (deviceId state 교체)');
} else if (content.includes(stateBefore)) {
  content = content.replace(stateBefore, stateAfter);
  changed = true;
  console.log('OK 2: deviceId를 useState("")로 변경 (SSR 안전)');
} else {
  console.log('X 2: deviceId useState 앵커 못 찾음 - 중단');
  process.exit(1);
}

// Patch 3: 마운트 시 deviceId를 useEffect에서 채우는 로직 추가
// 기존 "번역기 기록 복원" useEffect 바로 앞에 삽입
const effectAnchor = [
  "  // ── 마운트 시 번역기 기록 복원 (localStorage) ─────────────────────"
].join("\n");

const effectInsert = [
  "  // ── device_id 확정 (useEffect 안에서만 localStorage 접근, SSR 안전) ─",
  "  useEffect(() => {",
  "    setDeviceId(readOrCreateDeviceId());",
  "  }, []);",
  "",
  "  // ── 마운트 시 번역기 기록 복원 (localStorage) ─────────────────────"
].join("\n");

if (content.includes('device_id 확정 (useEffect 안에서만')) {
  console.log('SKIP 3: 이미 적용됨 (deviceId useEffect)');
} else if (content.includes(effectAnchor)) {
  content = content.replace(effectAnchor, effectInsert);
  changed = true;
  console.log('OK 3: deviceId를 useEffect에서 설정하는 로직 추가');
} else {
  console.log('X 3: 번역기 기록 복원 useEffect 앵커 못 찾음 - 중단');
  process.exit(1);
}

if (changed) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('=== page.tsx 저장 완료 ===');
}

console.log('');
console.log('참고: deviceId가 처음에는 빈 문자열("")입니다.');
console.log('deviceId를 사용하는 useEffect(푸시 구독 등)들은 deviceId가 채워진 후에만');
console.log('동작해야 하므로, deviceId가 falsy일 때 return하는 기존 가드(if (!deviceId) return;)가');
console.log('이미 있는지 확인이 필요합니다. 없으면 빈 문자열로 서버 요청이 나갈 수 있습니다.');