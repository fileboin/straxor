const postgres = require("postgres");
async function main() {
  const client = postgres(process.env.DATABASE_URL, { connect_timeout: 20 });
  // Projects to find which user owns "kalendar"
  const proj = await client.unsafe(
    "SELECT id, name, user_id FROM projects WHERE id='bfa9978d-fdc3-431a-95bd-01fcce7ff21a'"
  );
  console.log("project:", JSON.stringify(proj, null, 2));
  if (proj.length) {
    const uid = proj[0].user_id;
    const user = await client.unsafe("SELECT id, email FROM users WHERE id=$1", [uid]);
    console.log("user:", JSON.stringify(user));
    const repos = await client.unsafe(
      "SELECT full_name, is_active, slot FROM repo_connections WHERE user_id=$1", [uid]
    );
    console.log("user repos:", JSON.stringify(repos, null, 2));
    const tokens = await client.unsafe(
      "SELECT name, platform, is_default FROM git_connections WHERE user_id=$1", [uid]
    );
    console.log("user tokens:", JSON.stringify(tokens, null, 2));
  }
  await client.end();
}
main();
