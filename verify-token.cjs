const jwt = require("jsonwebtoken");
const fs = require("fs");
let secret;
for (const l of fs.readFileSync("server/.env", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && l.slice(0, i) === "JWT_SECRET") secret = l.slice(i + 1).trim();
}
const tok = process.argv[2];
try {
  const p = jwt.verify(tok, secret);
  console.log("VALID:", JSON.stringify(p));
} catch (e) {
  console.log("INVALID:", e.message);
}
