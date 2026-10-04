#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const npmBinary = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runProcess(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Process exited with code ${code}: ${command} ${args.join(' ')}`);
      process.exit(code || 1);
    }
  });

  return child;
}

console.log('Starting backend and frontend development servers...');
console.log('Backend: http://localhost:5000');
console.log('Frontend: http://localhost:5173');

const backend = runProcess(npmBinary, ['--prefix', './backend', 'run', 'dev'], rootDir);
const frontend = runProcess(npmBinary, ['--prefix', './frontend', 'run', 'dev', '--', '--host', '0.0.0.0'], rootDir);

const shutdown = () => {
  if (backend && !backend.killed) {
    backend.kill('SIGTERM');
  }

  if (frontend && !frontend.killed) {
    frontend.kill('SIGTERM');
  }

  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

backend.on('exit', () => {
  if (!frontend.killed) {
    frontend.kill('SIGTERM');
  }
  process.exit(0);
});

frontend.on('exit', () => {
  if (!backend.killed) {
    backend.kill('SIGTERM');
  }
  process.exit(0);
});
