const fs = require("fs");
const path = require("path");
function walk(d) {
  let a = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && e.name !== "dist") a = a.concat(walk(f));
    } else a.push(f);
  }
  return a;
}
const files = walk("client/src").concat(walk("server/src"));
const re = /Invalid token|ispravan|Unauthorized|invalid_token/i;
for (const f of files) {
  try {
    const c = fs.readFileSync(f, "utf8");
    const m = c.match(re);
    if (m) {
      const idx = c.indexOf(m[0]);
      const line = c.slice(0, idx).split("\n").length;
      console.log(f + ":" + line + " => " + c.slice(idx - 40, idx + 60).replace(/\n/, " "));
    }
  } catch {}
}
