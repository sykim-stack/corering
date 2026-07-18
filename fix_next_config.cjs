const fs = require("fs");
const path = "next.config.ts";
let content = fs.readFileSync(path, "utf8");

const before = "serverExternalPackages: ['@supabase/supabase-js', 'cloudinary', 'brainpool-os'],";
const after = "serverExternalPackages: ['cloudinary', 'brainpool-os'],";

if (content.includes(after)) {
  console.log("SKIP 이미 적용됨");
} else if (content.includes(before)) {
  content = content.replace(before, after);
  fs.writeFileSync(path, content, "utf8");
  console.log("OK supabase-js를 serverExternalPackages에서 제거 완료");
} else {
  console.log("X 대상 문자열 못 찾음 - 파일 내용 확인 필요");
}
