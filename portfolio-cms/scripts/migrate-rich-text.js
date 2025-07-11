const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your SQLite DB
const dbPath = path.join(__dirname, '../../strapi-data/strapi.db');
const db = new sqlite3.Database(dbPath);

function isOldFormat(body) {
  return body && typeof body === 'object' && body.root && Array.isArray(body.root.children);
}

function convertOldToBlocks(old) {
  if (!isOldFormat(old)) return old;
  const blocks = [];
  for (const para of old.root.children) {
    if (para.type === 'paragraph' && Array.isArray(para.children)) {
      const children = [];
      for (const node of para.children) {
        if (node.type === 'text') {
          children.push({ type: 'text', text: node.text || '' });
        } else if (node.type === 'linebreak') {
          // Convert linebreak to a newline in the previous text node, or as its own paragraph
          if (children.length && children[children.length-1].type === 'text') {
            children[children.length-1].text += '\n';
          } else {
            children.push({ type: 'text', text: '\n' });
          }
        }
      }
      blocks.push({ type: 'paragraph', children });
    }
    // Optionally handle other types (headings, etc.) here
  }
  return blocks;
}

function migrate() {
  db.serialize(() => {
    db.all("SELECT id, body FROM components_shared_rich_texts", [], (err, rows) => {
      if (err) throw err;
      let migrated = 0;
      rows.forEach(row => {
        let body;
        try {
          body = JSON.parse(row.body);
        } catch (e) {
          return; // skip invalid JSON
        }
        if (isOldFormat(body)) {
          const newBody = convertOldToBlocks(body);
          db.run("UPDATE components_shared_rich_texts SET body = ? WHERE id = ?", [JSON.stringify(newBody), row.id], (err) => {
            if (err) console.error(`Failed to update id ${row.id}:`, err);
            else migrated++;
          });
        }
      });
      setTimeout(() => {
        console.log(`Migration complete. Migrated ${migrated} entries.`);
        db.close();
      }, 1000);
    });
  });
}

migrate(); 