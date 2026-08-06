const path = require("path");
const root = path.resolve(__dirname);
const fs = require("fs");
const jwt = require(path.join(root, "server", "node_modules", "jsonwebtoken"));
const tok = process.argv[2];
let secret = "";
for (const l of fs.readFileSync(path.join(root, "server", ".env"), "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && l.slice(0, i) === "JWT_SECRET") secret = l.slice(i + 1).trim();
}
try {
  const p = jwt.verify(tok, secret);
  console.log("VALID:", JSON.stringify(p));
} catch (e) {
  console.log("INVALID:", e.message);
}
