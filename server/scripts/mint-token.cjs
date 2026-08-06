const jwt = require("jsonwebtoken");
const tok = jwt.sign(
  { userId: "677724b3-b69a-43eb-90c9-035261aaa243", email: "shots@straxor.local" },
  "b6d0cd6c7ecc6b0b17e9099e5aa4780b231c1178b83f73090e97215506c9908d",
  { expiresIn: "1h" }
);
console.log(tok);
