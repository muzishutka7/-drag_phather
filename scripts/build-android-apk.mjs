import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = path.join(projectRoot, 'android/app/version.properties');
const androidBuildDir = path.join(projectRoot, 'android/app/build/outputs/apk/debug');
const apkSource = path.join(androidBuildDir, 'app-debug.apk');
const releasesDir = path.join(projectRoot, 'releases');
const javaHome = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';

function readVersion() {
  const contents = readFileSync(versionFile, 'utf8');
  const versionCode = Number(contents.match(/^VERSION_CODE=(\d+)$/m)?.[1]);
  const versionName = contents.match(/^VERSION_NAME=(\d+\.\d+\.\d+)$/m)?.[1];

  if (!Number.isSafeInteger(versionCode) || !versionName) {
    throw new Error(`Invalid Android version configuration: ${versionFile}`);
  }

  return { contents, versionCode, versionName };
}

function run(command, args, { env = process.env, cwd = projectRoot } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
}

const previous = readVersion();
const [major, minor, patch] = previous.versionName.split('.').map(Number);
const versionName = `${major}.${minor}.${patch + 1}`;
const versionCode = previous.versionCode + 1;
const versionFileContents = `VERSION_CODE=${versionCode}\nVERSION_NAME=${versionName}\n`;
const versionedApk = path.join(releasesDir, `drag_${versionName.replaceAll('.', '_')}.apk`);

if (existsSync(versionedApk)) {
  throw new Error(`Refusing to overwrite an existing APK: ${versionedApk}`);
}

const env = { ...process.env };
if (existsSync(path.join(javaHome, 'bin/java'))) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${path.join(javaHome, 'bin')}${path.delimiter}${env.PATH ?? ''}`;
}

writeFileSync(versionFile, versionFileContents);

let buildCompleted = false;

try {
  run('npm', ['run', 'android:sync'], env);
  run('./gradlew', ['assembleDebug'], {
    env,
    cwd: path.join(projectRoot, 'android'),
  });

  if (!existsSync(apkSource)) {
    throw new Error(`Android build succeeded but APK was not found: ${apkSource}`);
  }

  mkdirSync(releasesDir, { recursive: true });
  copyFileSync(apkSource, versionedApk);
  console.log(`\nCreated ${path.relative(projectRoot, versionedApk)} (version ${versionName}, code ${versionCode}).`);
  buildCompleted = true;

  const openResult = spawnSync('open', [releasesDir], { stdio: 'inherit' });
  if (openResult.error || openResult.status !== 0) {
    console.warn(`Could not open the releases folder: ${openResult.error?.message ?? 'open command failed'}`);
  }
} finally {
  if (!buildCompleted) {
    writeFileSync(versionFile, previous.contents);
  }
}
