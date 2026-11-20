/** Check patch installation against real library sources without editing the installed dependency. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const patchName = 'patches/react-native-reanimated+4.7.1+preserve-css-during-native-exit.patch';
const scriptName = 'scripts/apply-reanimated-patch.mjs';
const patchText = readFileSync(resolve(projectRoot, patchName), 'utf8');
const changedFiles = [...patchText.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((match) => match[1]);

function fixture(t) {
    const root = mkdtempSync(resolve(tmpdir(), 'reanimated-patch-test-'));
    t.after(() => rmSync(root, {recursive: true, force: true}));
    for (const path of [...changedFiles, patchName, scriptName, 'node_modules/react-native-reanimated/package.json']) {
        mkdirSync(dirname(resolve(root, path)), {recursive: true});
        copyFileSync(resolve(projectRoot, path), resolve(root, path));
    }
    // A user can run these checks before or after applying the dependency patch.
    const reverseCheck = spawnSync('git', ['apply', '--reverse', '--check', resolve(root, patchName)], {cwd: root});
    if (reverseCheck.status === 0) {
        assert.equal(spawnSync('git', ['apply', '--reverse', resolve(root, patchName)], {cwd: root}).status, 0);
    }
    return root;
}

function run(root, ...args) {
    return spawnSync(process.execPath, [resolve(root, scriptName), ...args], {cwd: root, encoding: 'utf8'});
}

function hashes(root) {
    return changedFiles.map((path) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex'));
}

test('application is idempotent and reversal restores every original source file', (t) => {
    // Given pristine dependency sources, so the patch must be reversible for baseline comparisons.
    const root = fixture(t);
    const original = hashes(root);
    assert.equal(run(root, '--check').status, 0);
    assert.deepEqual(hashes(root), original);

    // When the patch is applied twice, the second application should leave the sources unchanged.
    assert.equal(run(root).status, 0);
    const patched = hashes(root);
    assert.notDeepEqual(patched, original);
    assert.equal(run(root).status, 0);
    assert.deepEqual(hashes(root), patched);

    // Then reversal restores all sources, and a repeated reversal is harmless.
    assert.equal(run(root, '--reverse').status, 0);
    assert.deepEqual(hashes(root), original);
    assert.equal(run(root, '--reverse').status, 0);
    assert.deepEqual(hashes(root), original);
});

test('source drift fails before any other file is patched', (t) => {
    // Given an independently edited dependency file that no longer matches a patch hunk.
    const root = fixture(t);
    writeFileSync(resolve(root, changedFiles[0]), 'Local dependency changes must be preserved.\n');
    const original = hashes(root);

    // When installation detects that conflict, it must reject the complete patch.
    const result = run(root);

    // Then all files retain their original contents, avoiding a partially patched native library.
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No files were changed/);
    assert.deepEqual(hashes(root), original);
});

test('another Reanimated version is rejected without editing native sources', (t) => {
    // Given a version upgrade, which may have different native lifecycle APIs.
    const root = fixture(t);
    writeFileSync(resolve(root, 'node_modules/react-native-reanimated/package.json'), JSON.stringify({version: '4.8.0'}));
    const original = hashes(root);

    // When the version-specific installer runs, it should require a deliberate patch update.
    const result = run(root);

    // Then the incompatible version is reported and its native sources stay intact.
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires Reanimated 4.7.1/);
    assert.deepEqual(hashes(root), original);
});
