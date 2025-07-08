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

function runDockerCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Running Docker command: ${command}`);
    exec(command, { cwd: workspacePath }, (err, stdout, stderr) => {
      if (err) {
        console.error(`Docker command error:`, err);
        console.error(`stderr:`, stderr);
        return reject(err);
      }
      console.log(`Docker command stdout:`, stdout);
      if (stderr) {
        console.log(`Docker command stderr:`, stderr);
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
    console.log('Starting site rebuild process...');
    
    // Stop the current eleventy container if running
    console.log('Stopping Eleventy container...');
    await runDockerCommand('docker-compose stop eleventy');
    
    // Remove the old container to ensure fresh build
    console.log('Removing old Eleventy container...');
    await runDockerCommand('docker-compose rm -f eleventy');
    
    // Start a new eleventy container which will rebuild the site
    console.log('Starting new Eleventy container to rebuild site...');
    await runDockerCommand('docker-compose up eleventy --no-deps');
    
    console.log('Site rebuild completed successfully');
    res.json({ success: true, message: 'Site rebuild triggered successfully' });
    
  } catch (error) {
    console.error('Error during site rebuild:', error);
    res.status(500).json({ 
      error: 'Site rebuild failed', 
      details: error.message 
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
