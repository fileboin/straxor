const postgres = require("postgres");
async function main() {
  const c = postgres(process.env.DATABASE_URL, { connect_timeout: 20 });
  await c.unsafe("UPDATE repo_connections SET is_active=false WHERE user_id='677724b3-b69a-43eb-90c9-035261aaa243'");
  const rows = await c.unsafe("SELECT slot, owner, name, is_active FROM repo_connections WHERE user_id='677724b3-b69a-43eb-90c9-035261aaa243'");
  console.log("shots repos now:", JSON.stringify(rows));
  await c.end();
}
main();
