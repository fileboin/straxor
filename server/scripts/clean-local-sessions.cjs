const postgres = require("postgres");
async function main() {
  const client = postgres(process.env.DATABASE_URL, { connect_timeout: 20 });
  // Delete test/local sessions that pollute UI restore for this user
  const del = await client.unsafe(
    "DELETE FROM sessions WHERE user_id='677724b3-b69a-43eb-90c9-035261aaa243' AND machine_id LIKE 'local:%' RETURNING id"
  );
  console.log("deleted local sessions:", JSON.stringify(del));
  await client.end();
}
main();
