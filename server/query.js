import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString:
    'postgres://postgres:6e1F4yJ9guWjhoKoGO70Iyc99uGsZjTjtnsSNIDk4pQBwCxl9SinoArqmMovRPSw@145.223.18.139:5431/postgres',
});

async function main() {
  await client.connect();
  console.log('Connected to DB');

  console.log('\n--- inward_from_po ---');
  const res1 = await client.query('SELECT * FROM app.inward_from_po');
  console.log(res1.rows);

  console.log('\n--- inward_from_po_items ---');
  const res2 = await client.query('SELECT * FROM app.inward_from_po_items');
  console.log(res2.rows);

  await client.end();
}

main().catch(console.error);
