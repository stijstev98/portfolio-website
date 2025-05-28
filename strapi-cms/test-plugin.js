// Simple test script to verify the rich content editor plugin is loaded
const fs = require('fs');
const path = require('path');

// Check if plugin files exist
const pluginPath = path.join(__dirname, 'src/plugins/rich-content-editor');
const packageJsonPath = path.join(pluginPath, 'package.json');
const adminIndexPath = path.join(pluginPath, 'admin/src/index.tsx');
const serverIndexPath = path.join(pluginPath, 'server/index.ts');

console.log('🔍 Checking Rich Content Editor Plugin...\n');

// Check if plugin directory exists
if (fs.existsSync(pluginPath)) {
  console.log('✅ Plugin directory exists');
} else {
  console.log('❌ Plugin directory missing');
  process.exit(1);
}

// Check package.json
if (fs.existsSync(packageJsonPath)) {
  console.log('✅ Package.json exists');
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(`   Plugin name: ${packageJson.strapi.name}`);
    console.log(`   Display name: ${packageJson.strapi.displayName}`);
  } catch (e) {
    console.log('⚠️  Error reading package.json');
  }
} else {
  console.log('❌ Package.json missing');
}

// Check admin files
if (fs.existsSync(adminIndexPath)) {
  console.log('✅ Admin index file exists');
} else {
  console.log('❌ Admin index file missing');
}

// Check server files
if (fs.existsSync(serverIndexPath)) {
  console.log('✅ Server index file exists');
} else {
  console.log('❌ Server index file missing');
}

// Check components
const componentsPath = path.join(pluginPath, 'admin/src/components');
if (fs.existsSync(componentsPath)) {
  const components = fs.readdirSync(componentsPath);
  console.log(`✅ Components found: ${components.join(', ')}`);
} else {
  console.log('❌ Components directory missing');
}

// Check if plugin is configured
const configPath = path.join(__dirname, 'config/plugins.ts');
if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, 'utf8');
  if (configContent.includes('rich-content-editor')) {
    console.log('✅ Plugin configured in plugins.ts');
  } else {
    console.log('⚠️  Plugin not found in plugins.ts configuration');
  }
} else {
  console.log('❌ Config file missing');
}

console.log('\n🎉 Plugin verification complete!');
console.log('\nNext steps:');
console.log('1. Start Strapi with: npm run develop');
console.log('2. Go to Content-Type Builder');
console.log('3. Add a "Rich Content" custom field to your content types');
console.log('4. Test the WYSIWYG editor with text formatting and custom components'); 