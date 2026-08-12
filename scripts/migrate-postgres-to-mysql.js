const fs = require('fs');
const path = require('path');

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = trimmed.indexOf('=');
    if (separator < 1) return;
    const key = trimmed.slice(0, separator).trim();
    if (Object.prototype.hasOwnProperty.call(process.env, key)) return;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
};

const workspaceRoot = path.resolve(__dirname, '..');
loadEnvFile(path.join(workspaceRoot, '.env'));
loadEnvFile(path.join(workspaceRoot, '.env.local'));

const postgres = require('../server/db/postgres');
const mysql = require('../server/db/mysql');

const args = new Set(process.argv.slice(2));
const replaceTarget = args.has('--replace');
const verifyOnly = args.has('--verify-only');

const snapshotIdentities = (snapshot) => ({
  app_singletons: (snapshot.singletons || []).map((row) => row.resource).sort(),
  app_items: (snapshot.items || []).map((row) => `${row.resource}:${row.id}`).sort(),
  quiz_bank_files: (snapshot.quizFiles || []).map((row) => row.fileName).sort(),
  events: (snapshot.events || []).map((row) => String(row.id)).sort(),
  event_registrants: (snapshot.events || []).flatMap((event) => (event.registrants || []).map((row) => `${event.id}:${row.id}`)).sort(),
  donation_campaigns: (snapshot.campaigns || []).map((row) => String(row.id)).sort(),
  donations: (snapshot.donations || []).map((row) => String(row.id)).sort(),
  donation_pending: (snapshot.pendingDonations || []).map((row) => String(row.id)).sort()
});

const compareObjects = (source, target) => Object.keys(source).flatMap((key) => (
  JSON.stringify(source[key]) === JSON.stringify(target[key])
    ? []
    : [{ key, source: source[key], target: target[key] }]
));

const closePools = async () => {
  await Promise.allSettled([
    postgres.pool?.end?.(),
    mysql.pool?.end?.()
  ]);
};

const run = async () => {
  if (!postgres.hasDatabaseConnection) {
    throw new Error('PostgreSQL source is not configured. Set DATABASE_URL or DB_HOST/DB_USER/DB_NAME.');
  }
  if (!mysql.hasDatabaseConnection) {
    throw new Error('MySQL target is not configured. Set MYSQL_URL or MYSQL_HOST/MYSQL_USER/MYSQL_DATABASE.');
  }

  await mysql.ensureEventsSchema();
  const sourceSnapshot = await postgres.exportSnapshot();
  const sourceCounts = await postgres.getDataCounts();
  const existingTargetCounts = await mysql.getDataCounts();
  const targetHasData = Object.values(existingTargetCounts).some((count) => count > 0);

  if (!verifyOnly && targetHasData && !replaceTarget) {
    throw new Error('MySQL target is not empty. Rerun with --replace to replace its runtime data, or --verify-only to compare it.');
  }

  if (!verifyOnly) {
    await mysql.importSnapshot(sourceSnapshot);
  }

  const targetSnapshot = await mysql.exportSnapshot();
  const targetCounts = await mysql.getDataCounts();
  const countMismatches = compareObjects(sourceCounts, targetCounts);
  const identityMismatches = compareObjects(snapshotIdentities(sourceSnapshot), snapshotIdentities(targetSnapshot));

  console.log(JSON.stringify({
    mode: verifyOnly ? 'verify-only' : 'migrate',
    source: 'postgresql',
    target: 'mysql',
    sourceCounts,
    targetCounts,
    countMismatches,
    identityMismatches,
    valid: countMismatches.length === 0 && identityMismatches.length === 0
  }, null, 2));

  if (countMismatches.length > 0 || identityMismatches.length > 0) {
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error(`MySQL migration failed: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(closePools);
