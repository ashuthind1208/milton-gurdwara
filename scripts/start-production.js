const fs = require('fs');
const path = require('path');

const buildIndexPath = path.resolve(__dirname, '..', 'build', 'index.html');
if (!fs.existsSync(buildIndexPath)) {
	console.error('Production build not found. Run "npm run build" before "npm run start:production".');
	process.exit(1);
}

process.env.NODE_ENV = 'production';
process.env.SERVER_PORT = String(process.env.SERVER_PORT || process.env.PORT || '3000');

require('../server/index');