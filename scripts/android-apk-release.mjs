#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const sourceArg = process.argv[2] ?? 'android/app/build/outputs/apk/debug/app-debug.apk';
const source = path.resolve(ROOT, sourceArg);

if (!existsSync(source)) {
  console.error(`APK not found: ${source}`);
  process.exit(1);
}

const packageJsonPath = path.resolve(ROOT, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = String(packageJson.version ?? '0.0.0');
const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
let shortCommit = 'nogit';
try {
  shortCommit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
} catch {
  /* keep nogit */
}

const downloadsDir = path.resolve(ROOT, 'public', 'downloads');
mkdirSync(downloadsDir, { recursive: true });

const versionedName = `toot-android-beta-v${version}-${date}-${shortCommit}.apk`;
const versionedTarget = path.resolve(downloadsDir, versionedName);
const latestTarget = path.resolve(downloadsDir, 'toot-android-beta.apk');

copyFileSync(source, versionedTarget);
copyFileSync(source, latestTarget);

console.log(`Versioned APK: ${versionedTarget}`);
console.log(`Latest APK:    ${latestTarget}`);
