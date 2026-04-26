// Run once:        node migrations/run.js
// Fresh (drop+seed): node migrations/run.js --fresh
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const pool = require('../db');

const MIGRATIONS = ['001_init.sql', '002_activity_log.sql'];

// Drop order must respect FK constraints (children before parents)
const DROP_TABLES = [
  'activity_log',
  'sensor_readings',
  'water_events',
  'plants',
];

async function fresh() {
  console.log('Dropping all tables...');
  for (const table of DROP_TABLES) {
    await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    console.log(`  dropped: ${table}`);
  }
}

async function migrate() {
  for (const file of MIGRATIONS) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    try {
      await pool.query(sql);
      console.log(`${file}: done.`);
    } catch (err) {
      console.error(`${file}: failed —`, err.message);
    }
  }
}

async function run() {
  const isFresh = process.argv.includes('--fresh');
  if (isFresh) await fresh();
  await migrate();
  await pool.end();
}

run();
