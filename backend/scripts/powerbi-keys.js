#!/usr/bin/env node
/**
 * Manage Power BI read-only API keys. The plaintext key is printed once.
 *
 *   node scripts/powerbi-keys.js create --name "Power BI English" --projects 58 --scope read
 *   node scripts/powerbi-keys.js list
 *   node scripts/powerbi-keys.js revoke --id 1
 *   node scripts/powerbi-keys.js rotate --id 1
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');
const keys = require('../powerbi-api/keyService');

function flag(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) return null;
  return args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const connected = await db.testConnection();
  if (!connected) process.exit(1);

  if (command === 'create') {
    const created = await keys.createKey(db, {
      name: flag(args, '--name'),
      projectIds: String(flag(args, '--projects') || '').split(',').map((id) => Number(id.trim())),
      scope: flag(args, '--scope') || 'read',
      expiresAt: args.includes('--no-expiry') ? null : undefined,
    });
    console.log(JSON.stringify({ ...created, api_key: created.api_key }, null, 2));
    console.log('Store api_key now. It cannot be retrieved later.');
  } else if (command === 'list') {
    console.log(JSON.stringify(await keys.listKeys(db), null, 2));
  } else if (command === 'revoke') {
    const ok = await keys.revokeKey(db, Number(flag(args, '--id')));
    if (!ok) {
      console.error('Key not found or already revoked');
      process.exitCode = 1;
    } else console.log('Revoked');
  } else if (command === 'rotate') {
    const created = await keys.rotateKey(db, Number(flag(args, '--id')));
    if (!created) {
      console.error('Key not found');
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(created, null, 2));
      console.log('Previous key was revoked. Store api_key now.');
    }
  } else {
    console.log('Usage: node scripts/powerbi-keys.js create|list|revoke|rotate');
    process.exitCode = 1;
  }
  await db.close();
}

main().catch(async (error) => {
  console.error(error.message);
  try { await db.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
