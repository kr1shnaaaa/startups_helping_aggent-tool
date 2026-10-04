#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const npmBinary = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function fail(message, errorDetails) {
  log(`\n❌ ${message}`, colors.red);
  if (errorDetails) {
    console.error(errorDetails);
  }
  process.exit(1);
}

function parseMajorNodeVersion(versionString) {
  const match = /^v?(\d+)/.exec(versionString || '');
  return match ? Number(match[1]) : NaN;
}

function ensurePrerequisites() {
  const nodeMajor = parseMajorNodeVersion(process.version);

  if (!Number.isFinite(nodeMajor)) {
    fail('Unable to determine the installed Node.js version.', `Current version: ${process.version || 'unknown'}`);
  }

  if (nodeMajor < 18) {
    fail(
      'This project requires Node.js 18 or newer. Please install a supported LTS version before running setup.',
      `Detected Node.js: ${process.version}`,
    );
  }

  const npmCheck = spawnSync(npmBinary, ['--version'], {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (npmCheck.status !== 0) {
    fail('npm is not available in PATH. Install Node.js and npm before continuing.', npmCheck.stderr || npmCheck.stdout);
  }

  if (!fs.existsSync(path.join(backendDir, 'package.json'))) {
    fail('The backend package.json file was not found.', backendDir);
  }

  if (!fs.existsSync(path.join(frontendDir, 'package.json'))) {
    fail('The frontend package.json file was not found.', frontendDir);
  }
}

function detectPackageManager(baseDir) {
  if (fs.existsSync(path.join(baseDir, 'pnpm-lock.yaml'))) {
    return { name: 'pnpm', binary: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm' };
  }

  if (fs.existsSync(path.join(baseDir, 'yarn.lock'))) {
    return { name: 'yarn', binary: process.platform === 'win32' ? 'yarn.cmd' : 'yarn' };
  }

  return { name: 'npm', binary: npmBinary };
}

function installDependencies(projectDir, label) {
  const packageJsonPath = path.join(projectDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    fail(`${label} package.json is missing.`, projectDir);
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    fail(`${label} package.json is invalid JSON.`, error.message);
  }

  const packageManager = detectPackageManager(projectDir);
  const useCi = packageManager.name === 'npm' && fs.existsSync(path.join(projectDir, 'package-lock.json'));
  const installArgs = useCi ? ['ci', '--no-fund', '--no-audit'] : ['install', '--no-fund', '--no-audit'];

  log(`\n${label} dependency install (${packageManager.name})...`, colors.blue);
  const installResult = spawnSync(packageManager.binary, installArgs, {
    cwd: projectDir,
    stdio: 'inherit',
    shell: false,
  });

  if (installResult.status !== 0) {
    fail(`${label} dependency installation failed.`, `Directory: ${projectDir}`);
  }

  if (!packageJson.name) {
    log(`Warning: ${label} package.json is missing a name field.`, colors.yellow);
  }
}

function copyEnvironmentTemplateIfNeeded() {
  const examplePath = path.join(backendDir, '.env.example');
  const targetPath = path.join(backendDir, '.env');

  if (!fs.existsSync(examplePath)) {
    log('No backend .env.example file found. Skipping environment copy.', colors.yellow);
    return;
  }

  if (fs.existsSync(targetPath)) {
    log('An existing backend/.env file is already present. Leaving it untouched.', colors.green);
    return;
  }

  fs.copyFileSync(examplePath, targetPath);
  log('Created backend/.env from backend/.env.example', colors.green);
}

function printEnvironmentGuidance() {
  const backendEnvExample = path.join(backendDir, '.env.example');

  if (fs.existsSync(backendEnvExample)) {
    const exampleText = fs.readFileSync(backendEnvExample, 'utf8');
    const vars = [...new Set((exampleText.match(/^\s*([A-Z0-9_]+)=/gm) || []).map((line) => line.trim().split('=')[0]))];

    if (vars.length > 0) {
      log('\n⚠ Please configure the following environment values before running the backend:', colors.yellow);
      vars.forEach((variableName) => {
        console.log(`  - ${variableName}`);
      });
    }
  }

  log('\nImportant runtime notes:', colors.blue);
  console.log('  - Backend API is served on http://localhost:5000');
  console.log('  - Frontend runs on the default Vite port http://localhost:5173');
  console.log('  - The frontend reads the backend via VITE_API_URL or defaults to http://localhost:5000/api');
  console.log('  - The backend requires MongoDB and Firebase configuration before it can start successfully.');
  console.log('  - No frontend .env.example was found in this repository; the client currently uses the Firebase web config in src/config/firebase-config.js.');
}

function validateRepositoryState() {
  const backendPackage = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8'));
  const frontendPackage = JSON.parse(fs.readFileSync(path.join(frontendDir, 'package.json'), 'utf8'));

  if (!backendPackage.scripts || !backendPackage.scripts.start || !backendPackage.scripts.dev) {
    fail('Backend package.json is missing the expected scripts for start/dev.', backendPackage);
  }

  if (!frontendPackage.scripts || !frontendPackage.scripts.dev || !frontendPackage.scripts.build) {
    fail('Frontend package.json is missing the expected scripts for dev/build.', frontendPackage);
  }

  log('\nValidation checks passed: backend and frontend package.json files contain the expected scripts.', colors.green);
  log('Optional runtime validation commands:', colors.blue);
  console.log('  npm --prefix ./backend test');
  console.log('  npm --prefix ./frontend run build');
}

function main() {
  const shouldValidate = process.argv.includes('--validate') || process.argv.includes('--check');

  log('Starting local setup for StartupLink...', colors.green);
  ensurePrerequisites();

  installDependencies(backendDir, 'Backend');
  installDependencies(frontendDir, 'Frontend');
  copyEnvironmentTemplateIfNeeded();
  printEnvironmentGuidance();

  if (shouldValidate) {
    validateRepositoryState();
  }

  log('\n✅ Setup completed successfully.', colors.green);
  log('Next steps:', colors.blue);
  console.log('  1. Fill in backend/.env with your MongoDB and Firebase values');
  console.log('  2. Run: npm run dev');
  console.log('  3. Open http://localhost:5173 and http://localhost:5000/api/health');
}

try {
  main();
} catch (error) {
  fail('Unexpected setup failure.', error && error.stack ? error.stack : error);
}
