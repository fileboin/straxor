const fs = require("fs");
const e = {};
for (const l of fs.readFileSync("server/.env", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0) e[l.slice(0, i)] = l.slice(i + 1).trim();
}
console.log("JWT_SECRET prefix:", String(e.JWT_SECRET).slice(0, 8));
console.log("JWT_SECRET matches my-mint(b6d)?:", String(e.JWT_SECRET) === "b6d0cd6c7ecc6b0b17e9099e5aa4780b231c1178b83f73090e97215506c9908d");
console.log("JWT_SECRET matches render(da9c)?:", String(e.JWT_SECRET).slice(0,8));
