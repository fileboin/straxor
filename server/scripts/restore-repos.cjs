const postgres = require("postgres");
async function main() {
  const c = postgres(process.env.DATABASE_URL, { connect_timeout: 20 });
  await c.unsafe("UPDATE repo_connections SET is_active=false WHERE user_id='677724b3-b69a-43eb-90c9-035261aaa243'");
  await c.unsafe("UPDATE repo_connections SET is_active=true WHERE user_id='677724b3-b69a-43eb-90c9-035261aaa243' AND slot='agent' AND name='straxor'");
  await c.unsafe("UPDATE repo_connections SET is_active=true WHERE user_id='677724b3-b69a-43eb-90c9-035261aaa243' AND slot='ask' AND name='Hello-World'");
  const rows = await c.unsafe("SELECT slot, name, is_active FROM repo_connections WHERE user_id='677724b3-b69a-43eb-90c9-035261aaa243' ORDER BY slot");
  console.log("shots repos restored:", JSON.stringify(rows));
  await c.end();
}
main();
