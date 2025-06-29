const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

const app = express();

// Parse GitHub webhook with raw body capture for signature verification
app.use('/github', express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
// Parse JSON normally for other routes
app.use(express.json());

const githubSecret = process.env.GITHUB_SECRET || '';
const strapiSecret = process.env.STRAPI_WEBHOOK_SECRET || '';
const repoPath = '/workspace';

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`Body:`, JSON.stringify(req.body, null, 2));
  next();
});

function runScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`Running script: ${script}`);
    exec(script, { cwd: repoPath }, (err, stdout, stderr) => {
      if (err) {
        console.error(`Script error:`, err);
        return reject(err);
      }
      console.log(`Script stdout:`, stdout);
      console.error(`Script stderr:`, stderr);
      resolve();
    });
  });
}

function verifyGitHub(req) {
  const signature = req.headers['x-hub-signature-256'];
  const digest = 'sha256=' + crypto.createHmac('sha256', githubSecret).update(req.rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(digest));
}

app.post('/github', async (req, res) => {
  console.log('GitHub webhook received');
  if (!verifyGitHub(req)) {
    console.log('GitHub webhook verification failed');
    return res.status(401).end();
  }
  if (req.body.ref === 'refs/heads/main') {
    try {
      await runScript('scripts/deploy.sh');
    } catch (e) {
      console.error('GitHub webhook script error:', e);
    }
  }
  res.json({ ok: true });
});

app.post('/strapi', async (req, res) => {
  console.log('Strapi webhook received');
  const token = req.headers['authorization']?.replace('Bearer ', '') || '';
  console.log('Received token:', token);
  console.log('Expected token:', strapiSecret);
  if (token !== strapiSecret) {
    console.log('Strapi webhook verification failed');
    return res.status(401).end();
  }
  try {
    console.log('Running rebuild script...');
    await runScript('scripts/rebuild.sh');
    console.log('Rebuild script completed');
  } catch (e) {
    console.error('Strapi webhook script error:', e);
  }
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => console.log('Webhook server running on 3000'));
