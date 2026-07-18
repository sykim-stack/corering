const fs = require("fs");
const path = "package.json";
const pkg = JSON.parse(fs.readFileSync(path, "utf8"));

if (pkg.scripts && pkg.scripts.type) {
  delete pkg.scripts.type;
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log("OK scripts에서 잘못된 type 필드 제거 완료");
} else {
  console.log("SKIP scripts.type 없음 - 이미 정상이거나 다른 문제");
}
