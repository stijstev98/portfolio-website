const fetch = require('node-fetch');

async function authenticateStrapi() {
  try {
    console.log('Authenticating with Strapi...');
    
    // Default admin credentials
    const credentials = {
      identifier: 'admin@example.com', // Default Strapi admin email
      password: 'Admin123!'             // Default Strapi admin password
    };
    
    const response = await fetch('http://127.0.0.1:1337/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    if (!response.ok) {
      throw new Error(`Authentication failed: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('Authentication successful!');
    return data.data.token;
  } catch (error) {
    console.error('Authentication error:', error.message);
    return null;
  }
}

// Execute authentication
authenticateStrapi()
  .then(token => {
    console.log('JWT Token:', token);
  })
  .catch(error => {
    console.error('Script failed:', error);
  });
