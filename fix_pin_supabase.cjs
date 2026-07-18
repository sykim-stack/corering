const fs = require("fs");
const path = "package.json";
const pkg = JSON.parse(fs.readFileSync(path, "utf8"));

pkg.dependencies["@supabase/supabase-js"] = "2.108.0";

fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("OK supabase-js 버전 2.108.0으로 고정 완료");
