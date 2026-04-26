// Run once: node migrations/run.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const pool = require('../db');

const MIGRATIONS = ['001_init.sql', '002_activity_log.sql'];

async function run() {
  for (const file of MIGRATIONS) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    try {
      await pool.query(sql);
      console.log(`${file}: done.`);
    } catch (err) {
      console.error(`${file}: failed —`, err.message);
    }
  }
  await pool.end();
}

run();
