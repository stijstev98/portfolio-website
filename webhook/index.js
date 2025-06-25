const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());

const githubSecret = process.env.GITHUB_SECRET || '';
const strapiSecret = process.env.STRAPI_WEBHOOK_SECRET || '';
const repoPath = '/workspace';

function runScript(script) {
  return new Promise((resolve, reject) => {
    exec(script, { cwd: repoPath }, (err, stdout, stderr) => {
      if (err) return reject(err);
      console.log(stdout);
      console.error(stderr);
      resolve();
    });
  });
}

function verifyGitHub(req) {
  const signature = req.headers['x-hub-signature-256'];
  const digest = 'sha256=' + crypto.createHmac('sha256', githubSecret).update(JSON.stringify(req.body)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(digest));
}

app.post('/github', async (req, res) => {
  if (!verifyGitHub(req)) {
    return res.status(401).end();
  }
  if (req.body.ref === 'refs/heads/main') {
    try {
      await runScript('scripts/deploy.sh');
    } catch (e) {
      console.error(e);
    }
  }
  res.json({ ok: true });
});

app.post('/strapi', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '') || '';
  if (token !== strapiSecret) {
    return res.status(401).end();
  }
  try {
    await runScript('scripts/rebuild.sh');
  } catch (e) {
    console.error(e);
  }
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => console.log('Webhook server running on 3000'));
