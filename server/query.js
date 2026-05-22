import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString:
    'postgres://postgres:6e1F4yJ9guWjhoKoGO70Iyc99uGsZjTjtnsSNIDk4pQBwCxl9SinoArqmMovRPSw@145.223.18.139:5431/postgres',
});

async function main() {
  await client.connect();
  console.log('Connected to DB');

  const query = `
    SELECT 
      mi.inward_id,
      mi.master_product_id,
      mp.product_type,
      mi.quantity,
      mi.bill_no,
      mi.inward_date
    FROM app.material_inward mi
    LEFT JOIN app.master_products mp ON mi.master_product_id = mp.master_product_id
    ORDER BY mi.inward_id DESC
    LIMIT 20
  `;

  const res = await client.query(query);
  console.log(JSON.stringify(res.rows, null, 2));

  await client.end();
}

main().catch(console.error);
