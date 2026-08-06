const path = require("path");
const root = path.resolve(__dirname);
const jwt = require(path.join(root, "server", "node_modules", "jsonwebtoken"));
const tok = jwt.sign(
  { userId: "0cee20f2-2a1a-4bd1-ba77-e2557f1ddac1", email: "telgram@tutamail.com" },
  "b6d0cd6c7ecc6b0b17e9099e5aa4780b231c1178b83f73090e97215506c9908d",
  { expiresIn: "2h" }
);
console.log(tok);
