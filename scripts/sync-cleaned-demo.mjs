import { access, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const siteRoot = process.cwd();
const sourceDir = process.env.CLEANED_DEMO_CLIENT_DIR
    ? path.resolve(process.env.CLEANED_DEMO_CLIENT_DIR)
    : path.resolve(siteRoot, '../cleaned-demo/client');
const destinationDir = path.resolve(siteRoot, 'public/demo/cleaned');

const filesToSync = [
    'annotation-renderer.js',
    'app.js',
    'editor.js',
    'index.html',
    'style.css',
];

async function main() {
    await access(sourceDir);
    await mkdir(destinationDir, { recursive: true });

    for (const file of filesToSync) {
        const source = path.join(sourceDir, file);
        const destination = path.join(destinationDir, file);
        await copyFile(source, destination);
        console.log(`[sync-cleaned-demo] ${file}`);
    }

    console.log(`[sync-cleaned-demo] synced ${filesToSync.length} files from ${sourceDir}`);
}

main().catch((error) => {
    console.error('[sync-cleaned-demo] failed:', error);
    process.exitCode = 1;
});
