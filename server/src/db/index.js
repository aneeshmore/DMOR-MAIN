import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../config/logger.js';
import * as schema from './schema/index.js';

dotenv.config();

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is not set');
  throw new Error('DATABASE_URL is required');
}

const { Pool } = pg;

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Drizzle ORM
export const db = drizzle(pool, { schema, logger: process.env.NODE_ENV === 'development' });

// Set search path using an initialization query/event if needed,
// but Drizzle queries are usually fully qualified with schema names.
pool.on('error', err => {
  logger.error('Unexpected error on idle client', err);
});

// Verify connection & ensure missing columns
pool
  .query('SELECT 1')
  .then(() => {
    logger.info('Database connection established with Drizzle ORM (PostgreSQL)');
    return pool.query(
      'ALTER TABLE app.product_development ADD COLUMN IF NOT EXISTS is_sync_with_density BOOLEAN DEFAULT true;'
    );
  })
  .then(() => {
    logger.info('Database schema verified: app.product_development.is_sync_with_density ensured');
  })
  .catch(err => {
    logger.error('Failed to connect or migrate database', err);
  });

export default db;
