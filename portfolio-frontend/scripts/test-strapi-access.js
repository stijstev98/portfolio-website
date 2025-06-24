// Simple script to test Strapi API access
const fetch = require('node-fetch');
const fs = require('fs');

const API_URL = 'http://127.0.0.1:1337/api';

// Set up log file
const logFile = '/Users/stijnstevens/Desktop/PROJECTS/WEBSITE_REDESIGN/scripts/strapi-test.log';
fs.writeFileSync(logFile, `Starting test at ${new Date().toISOString()}\n`, 'utf8');

// Helper function for logging to both console and file
// eslint-disable-next-line no-unused-vars
function log(message) {
  const entry = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync(logFile, entry, 'utf8');
  console.log(message);
}

async function testAccess() {
  try {
    console.log('Starting API tests...');

    // Test getting posts
    console.log('Testing GET /api/posts...');
    const getRes = await fetch(`${API_URL}/posts`).catch((err) => {
      console.error('Network error during GET:', err.message);
      return { ok: false, status: 'network_error' };
    });

    if (!getRes) {
      console.error('GET request failed completely');
      return;
    }

    if (getRes.ok) {
      const data = await getRes.json();
      console.log('GET successful!');
      console.log(`Found ${data.data?.length || 0} posts`);
    } else {
      console.error(`GET failed: ${getRes.status} ${getRes.statusText}`);
      const text = await getRes.text().catch(() => 'Could not get error text');
      console.error('Error details:', text);
    }

    // Test creating a post
    console.log('\nTesting POST /api/posts...');

    const testPost = {
      data: {
        post_title: 'Test Post',
        post_description: 'This is a test post',
      },
    };

    const postRes = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPost),
    }).catch((err) => {
      console.error('Network error during POST:', err.message);
      return { ok: false, status: 'network_error' };
    });

    if (!postRes) {
      console.error('POST request failed completely');
      return;
    }

    if (postRes.ok) {
      const data = await postRes.json();
      console.log('POST successful!');
      console.log('Created post:', data.data.id);
    } else {
      console.error(`POST failed: ${postRes.status} ${postRes.statusText}`);
      const text = await postRes.text().catch(() => 'Could not get error text');
      console.error('Error details:', text);
    }

    // Test uploading a file
    console.log('\nTesting POST /api/upload...');
    console.log('(Skipping actual upload as it requires multipart form data)');
    console.log('Please refer to the main script for the upload implementation.');
  } catch (error) {
    console.error('Error testing Strapi access:', error);
  }
}

testAccess();
