const normalizedEngine = String(process.env.DB_ENGINE || 'postgresql').trim().toLowerCase();

if (!['postgresql', 'postgres', 'mysql'].includes(normalizedEngine)) {
  throw new Error(`Unsupported DB_ENGINE "${normalizedEngine}". Use "postgresql" or "mysql".`);
}

const adapter = normalizedEngine === 'mysql'
  ? require('./mysql')
  : require('./postgres');

module.exports = {
  ...adapter,
  engine: normalizedEngine === 'mysql' ? 'mysql' : 'postgresql'
};