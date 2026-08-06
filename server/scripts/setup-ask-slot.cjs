const postgres = require("postgres");
async function main() {
  const client = postgres(process.env.DATABASE_URL, { connect_timeout: 20 });
  const uid = "0cee20f2-2a1a-4bd1-ba77-e2557f1ddac1";
  // Make straxor active for BOTH slots (agent + ask) for this user
  await client.unsafe(
    "UPDATE repo_connections SET is_active = CASE WHEN slot='ask' THEN false ELSE is_active END WHERE user_id=$1",
    [uid]
  );
  // There's no ask-slot row; the same straxor repo can serve both slots by
  // updating its slot row. Since only one row exists (slot=agent), we add a
  // separate active row for the ask slot pointing at the same repo.
  const existing = await client.unsafe(
    "SELECT id FROM repo_connections WHERE user_id=$1 AND full_name='fileboin/straxor' AND slot='ask'",
    [uid]
  );
  if (existing.length === 0) {
    const src = await client.unsafe(
      "SELECT * FROM repo_connections WHERE user_id=$1 AND full_name='fileboin/straxor' AND slot='agent'",
      [uid]
    );
    const r = src[0];
    await client.unsafe(
      "INSERT INTO repo_connections (id, user_id, platform, owner, name, full_name, clone_url, default_branch, is_active, slot, connection_type, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,'ask',$9, now(), now()) ON CONFLICT DO NOTHING",
      [crypto.randomUUID(), uid, r.platform, r.owner, r.name, r.full_name, r.clone_url, r.default_branch, r.connection_type || "token"]
    );
    console.log("added ask-slot row for straxor");
  } else {
    await client.unsafe(
      "UPDATE repo_connections SET is_active=true WHERE id=$1", [existing[0].id]
    );
    console.log("activated existing ask row");
  }
  const rows = await client.unsafe(
    "SELECT full_name, is_active, slot FROM repo_connections WHERE user_id=$1 ORDER BY slot",
    [uid]
  );
  console.log("final:", JSON.stringify(rows, null, 2));
  await client.end();
}
main();
