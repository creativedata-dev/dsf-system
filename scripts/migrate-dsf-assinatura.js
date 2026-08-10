const { neon } = require('@neondatabase/serverless')

async function main() {
  const sql = neon(process.env.DATABASE_URL)
  await sql`ALTER TABLE "DSF" ADD COLUMN IF NOT EXISTS "hashDocumento" TEXT`
  await sql`ALTER TABLE "DSF" ADD COLUMN IF NOT EXISTS "assinadoEm" TIMESTAMP`
  console.log('Migration aplicada com sucesso')
}

main().catch(e => { console.error(e); process.exit(1) })
