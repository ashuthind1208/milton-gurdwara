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
const { relationalTableNames } = require('../server/db/mysql-relational-schema');

const args = new Set(process.argv.slice(2));
const replaceTarget = args.has('--replace');
const verifyOnly = args.has('--verify-only');
const syncRelationalOnly = args.has('--sync-relational-only');

const relationalMigrationOrder = [
  'admin_users',
  'cms_pages',
  'cms_page_sections',
  'cms_hero_slides',
  'schedule_days',
  'schedule_entries',
  'langar_items',
  'advertisements',
  'news_articles',
  'gallery_albums',
  'gallery_images',
  'videos',
  'streaming_configs',
  'subscribers',
  'seva_opportunities',
  'volunteer_registrations',
  'library_physical_books',
  'library_issue_records',
  'library_digital_resources',
  'library_program_updates',
  'library_media_resources',
  'hukamnama_entries',
  'hukamnama_lines',
  'donation_records',
  'analytics_daily_metrics'
];

if (relationalMigrationOrder.length !== relationalTableNames.length
  || relationalMigrationOrder.some((table) => !relationalTableNames.includes(table))) {
  throw new Error('Relational migration order does not match the relational schema table list.');
}

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

const toMysqlValue = (value) => {
  if (value == null || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
};

const syncRelationalTables = async () => {
  const sourceRows = new Map();
  for (const table of relationalMigrationOrder) {
    const result = await postgres.pool.query(`SELECT * FROM ${table};`);
    sourceRows.set(table, result.rows);
  }

  const connection = await mysql.pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const table of [...relationalMigrationOrder].reverse()) {
      await connection.query(`DELETE FROM ${table}`);
    }
    for (const table of relationalMigrationOrder) {
      for (const row of sourceRows.get(table) || []) {
        const columns = Object.keys(row);
        const identifiers = columns.map((column) => `\`${column}\``).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        await connection.execute(
          `INSERT INTO \`${table}\` (${identifiers}) VALUES (${placeholders})`,
          columns.map((column) => toMysqlValue(row[column]))
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getSchemaTables = async () => {
  const [sourceResult, targetResult] = await Promise.all([
    postgres.pool.query("SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename;"),
    mysql.pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name;')
  ]);
  return {
    source: sourceResult.rows.map((row) => row.tablename),
    target: targetResult[0].map((row) => row.TABLE_NAME || row.table_name)
  };
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
  const targetHasData = ['app_singletons', 'app_items', 'quiz_bank_files', 'events', 'event_registrants', 'donation_campaigns', 'donations', 'donation_pending']
    .some((table) => existingTargetCounts[table] > 0);

  if (!verifyOnly && !syncRelationalOnly && targetHasData && !replaceTarget) {
    throw new Error('MySQL target is not empty. Rerun with --replace to replace its runtime data, or --verify-only to compare it.');
  }

  if (!verifyOnly && !syncRelationalOnly) {
    await mysql.importSnapshot(sourceSnapshot);
  }
  if (!verifyOnly) await syncRelationalTables();
  if (syncRelationalOnly) await mysql.syncRelationalMirrorsFromContentStore();

  const targetSnapshot = await mysql.exportSnapshot();
  const targetCounts = await mysql.getDataCounts();
  const countMismatches = compareObjects(sourceCounts, targetCounts);
  const relationalCountDifferences = countMismatches.filter(({ key }) => relationalTableNames.includes(key));
  const canonicalCountDifferences = countMismatches.filter(({ key }) => !relationalTableNames.includes(key));
  const identityMismatches = syncRelationalOnly
    ? []
    : compareObjects(snapshotIdentities(sourceSnapshot), snapshotIdentities(targetSnapshot));
  const schemaTables = await getSchemaTables();
  const schemaMismatches = {
    missingInTarget: schemaTables.source.filter((table) => !schemaTables.target.includes(table)),
    extraInTarget: schemaTables.target.filter((table) => !schemaTables.source.includes(table))
  };

  console.log(JSON.stringify({
    mode: verifyOnly ? 'verify-only' : (syncRelationalOnly ? 'sync-relational-only' : 'migrate'),
    source: 'postgresql',
    target: 'mysql',
    sourceTableCount: schemaTables.source.length,
    targetTableCount: schemaTables.target.length,
    schemaMismatches,
    sourceCounts,
    targetCounts,
    countMismatches,
    relationalCountDifferences,
    canonicalCountDifferences,
    identityMismatches,
    valid: (syncRelationalOnly || countMismatches.length === 0)
      && (syncRelationalOnly || identityMismatches.length === 0)
      && schemaMismatches.missingInTarget.length === 0
      && schemaMismatches.extraInTarget.length === 0
  }, null, 2));

  if ((!syncRelationalOnly && countMismatches.length > 0)
    || (!syncRelationalOnly && identityMismatches.length > 0)
    || schemaMismatches.missingInTarget.length > 0
    || schemaMismatches.extraInTarget.length > 0) {
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error(`MySQL migration failed: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(closePools);
