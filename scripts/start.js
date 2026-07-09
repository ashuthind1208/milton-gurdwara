const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const entries = {};

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) {
      return;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  });

  return entries;
};

const localEnvPath = path.resolve(process.cwd(), '.env.local');
const localEnv = loadEnvFile(localEnvPath);
const mergedEnv = {
  ...process.env,
  ...localEnv
};

const backendPort = mergedEnv.STRIPE_API_PORT || '4242';

const backend = spawn(process.execPath, ['server/index.js'], {
  stdio: 'inherit',
  env: {
    ...mergedEnv,
    PORT: backendPort
  }
});

const frontend = spawn('npx', ['react-scripts', 'start'], {
  stdio: 'inherit',
  env: {
    ...mergedEnv,
    PORT: mergedEnv.PORT || '3000',
    BROWSER: mergedEnv.BROWSER || 'none'
  },
  shell: true
});

const shutdown = (signal) => {
  if (!backend.killed) {
    backend.kill(signal);
  }
  if (!frontend.killed) {
    frontend.kill(signal);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

backend.on('exit', (code) => {
  if (code && code !== 0) {
    frontend.kill('SIGTERM');
    process.exit(code);
  }
});

frontend.on('exit', (code) => {
  backend.kill('SIGTERM');
  process.exit(code || 0);
});