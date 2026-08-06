const postgres = require("postgres");
async function main() {
  const client = postgres(process.env.DATABASE_URL, { connect_timeout: 20 });
  const rows = await client.unsafe(
    "SELECT id, machine_id, opencode_session_id, title, status, created_at FROM sessions WHERE user_id='677724b3-b69a-43eb-90c9-035261aaa243' ORDER BY created_at DESC LIMIT 5"
  );
  console.log(JSON.stringify(rows, null, 2));
  await client.end();
}
main();
