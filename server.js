process.env.NODE_ENV = 'production';
process.env.SERVER_PORT = String(process.env.SERVER_PORT || process.env.PORT || '3000');

require('./scripts/start-production');