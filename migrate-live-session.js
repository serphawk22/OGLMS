// Migration script: adds meetingLink and instructorId to LiveSession
// Run: node migrate-live-session.js
require("dotenv").config({ path: ".env" });
const { Client } = require("pg");

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected to database.");

  try {
    // Add meetingLink column if not exists
    await client.query(`
      ALTER TABLE "LiveSession"
      ADD COLUMN IF NOT EXISTS "meetingLink" TEXT;
    `);
    console.log('✅ meetingLink column added (or already exists).');

    // Add instructorId column if not exists
    await client.query(`
      ALTER TABLE "LiveSession"
      ADD COLUMN IF NOT EXISTS "instructorId" TEXT;
    `);
    console.log('✅ instructorId column added (or already exists).');

    // Add FK index for instructorId
    await client.query(`
      CREATE INDEX IF NOT EXISTS "LiveSession_instructorId_idx"
      ON "LiveSession"("instructorId");
    `);
    console.log('✅ Index on instructorId created (or already exists).');

    console.log('\n🎉 Migration complete! Run: npx prisma generate');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
