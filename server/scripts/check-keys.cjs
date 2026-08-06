const postgres = require("postgres");
async function main() {
  const c = postgres(process.env.DATABASE_URL, { connect_timeout: 20 });
  const cols = await c.unsafe("SELECT column_name FROM information_schema.columns WHERE table_name='user_api_keys'");
  console.log("cols:", JSON.stringify(cols.map((x) => x.column_name)));
  const t = await c.unsafe("SELECT user_id, provider_id, is_enabled FROM user_api_keys WHERE user_id='0cee20f2-2a1a-4bd1-ba77-e2557f1ddac1'");
  console.log("telgram:", JSON.stringify(t));
  const s = await c.unsafe("SELECT user_id, provider_id, is_enabled FROM user_api_keys WHERE user_id='677724b3-b69a-43eb-90c9-035261aaa243'");
  console.log("shots:", JSON.stringify(s));
  await c.end();
}
main();
