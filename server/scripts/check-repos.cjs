const postgres = require("postgres");
async function main() {
  const c = postgres(process.env.DATABASE_URL, { connect_timeout: 20 });
  const rows = await c.unsafe(
    "SELECT user_id, slot, owner, name, is_active FROM repo_connections WHERE user_id='677724b3-b69a-43eb-90c9-035261aaa243'"
  );
  console.log("shots repos:", JSON.stringify(rows, null, 2));
  await c.end();
}
main();
