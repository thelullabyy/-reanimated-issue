/** Apply the opt-in native patch only when every hunk matches the installed library. */
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const patchPath = resolve(projectRoot, 'patches/react-native-reanimated+4.7.1+preserve-css-during-native-exit.patch');
const options = new Set(process.argv.slice(2));
const supportedOptions = new Set(['--check', '--reverse']);
if ([...options].some((option) => !supportedOptions.has(option))) {
    throw new Error('Usage: node scripts/apply-reanimated-patch.mjs [--check] [--reverse]');
}

const installed = JSON.parse(readFileSync(resolve(projectRoot, 'node_modules/react-native-reanimated/package.json'), 'utf8'));
if (installed.version !== '4.7.1') {
    throw new Error(`This patch requires Reanimated 4.7.1; found ${installed.version}.`);
}

function apply(reverse, check) {
    return spawnSync('git', ['apply', ...(reverse ? ['--reverse'] : []), ...(check ? ['--check'] : []), patchPath], {
        cwd: projectRoot,
        encoding: 'utf8',
    });
}

const reverse = options.has('--reverse');
const check = apply(reverse, true);
if (check.status !== 0) {
    const opposite = apply(!reverse, true);
    if (opposite.status === 0) {
        console.log(reverse ? 'Reanimated patch is already removed.' : 'Reanimated patch is already applied.');
    } else {
        throw new Error(`Installed sources do not match either side of the patch. No files were changed.\n${check.stderr || check.error || ''}`);
    }
} else if (options.has('--check')) {
    console.log(reverse ? 'Reanimated patch can be removed cleanly.' : 'Reanimated patch can be applied cleanly.');
} else {
    const result = apply(reverse, false);
    if (result.status !== 0) {
        throw new Error(`Could not ${reverse ? 'remove' : 'apply'} the patch.\n${result.stderr || result.error || ''}`);
    }
    console.log(reverse ? 'Reanimated patch removed. Rebuild the native app.' : 'Reanimated patch applied. Rebuild the native app; Expo Go cannot load patched C++ code.');
}
