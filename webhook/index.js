const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();

// Parse JSON for all routes
app.use(express.json());

const strapiSecret = process.env.STRAPI_WEBHOOK_SECRET || '';
const workspacePath = '/workspace';

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`Body:`, JSON.stringify(req.body, null, 2));
  next();
});

function runCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Running command: ${command}`);
    exec(command, { cwd: workspacePath }, (err, stdout, stderr) => {
      if (err) {
        console.error(`Command error:`, err);
        console.error(`stderr:`, stderr);
        return reject(err);
      }
      console.log(`Command stdout:`, stdout);
      if (stderr) {
        console.log(`Command stderr:`, stderr);
      }
      resolve(stdout);
    });
  });
}

app.post('/strapi', async (req, res) => {
  console.log('Strapi webhook received');
  
  // Verify webhook secret
  const token = req.headers['authorization']?.replace('Bearer ', '') || '';
  console.log('Received token:', token ? 'PROVIDED' : 'MISSING');
  
  if (token !== strapiSecret) {
    console.log('Strapi webhook verification failed');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Starting site rebuild...');
    
    // Use the new webhook script instead of Docker
    const webhookScript = `${workspacePath}/scripts/webhook-prod.sh`;
    
    console.log(`Running webhook script: ${webhookScript}`);
    await runCommand(`${webhookScript} webhook`);
    
    console.log('Site rebuild triggered successfully');
    res.json({ 
      success: true, 
      message: 'Site rebuild triggered successfully',
      timestamp: new Date().toISOString(),
      method: 'script-based'
    });
    
  } catch (error) {
    console.error('Error during site rebuild:', error);
    res.status(500).json({ 
      error: 'Failed to rebuild site', 
      details: error.message,
      method: 'script-based'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'strapi-webhook-handler'
  });
});

// Root endpoint for basic info
app.get('/', (req, res) => {
  res.json({
    service: 'Strapi Webhook Handler',
    endpoints: {
      '/strapi': 'POST - Trigger site rebuild on Strapi content changes',
      '/health': 'GET - Health check endpoint'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Strapi webhook server running on port ${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /strapi - Trigger site rebuild');
  console.log('  GET /health - Health check');
});
