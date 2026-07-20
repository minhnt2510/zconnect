/**
 * One-time sync: uploads local ./uploads/ directory to S3.
 * Run: node scripts/sync-to-s3.js
 */
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { readdirSync, statSync, createReadStream } = require('fs');
const { join } = require('path');
const { config } = require('dotenv');

config({ path: join(__dirname, '..', '.env') });

const region = process.env.AWS_REGION || '';
const bucket = process.env.AWS_S3_BUCKET || '';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

if (!region || !bucket || !accessKeyId || !secretAccessKey) {
  console.error('Missing AWS env vars in .env');
  process.exit(1);
}

const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
const rootDir = join(__dirname, '..', 'uploads');

let synced = 0;
let skipped = 0;

async function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) { await walk(full); continue; }
    const relative = full.replace(/\\/g, '/');
    const idx = relative.indexOf('uploads/');
    if (idx === -1) continue;
    const key = relative.slice(idx);
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      skipped++;
      process.stdout.write(`\x1b[33mSKIP\x1b[0m ${key}\n`);
    } catch {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(full),
        ContentType: getContentType(key),
      }));
      synced++;
      process.stdout.write(`\x1b[32mOK\x1b[0m  ${key}\n`);
    }
  }
}

function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  return map[ext] || 'application/octet-stream';
}

(async () => {
  console.log(`Syncing ${rootDir} → s3://${bucket}/uploads/`);
  await walk(rootDir);
  console.log(`\nDone. Synced: ${synced}, Skipped (already exist): ${skipped}`);
})();
