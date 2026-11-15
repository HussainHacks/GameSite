import fs from 'fs';
import path from 'path';

const rootDir = path.resolve();
const catalogPath = path.join(rootDir, 'public', 'data', 'games.json');
const publicDir = path.join(rootDir, 'public');

console.log('== Validating Neon Arcade Catalog ==');
console.log('Reading:', catalogPath);

if (!fs.existsSync(catalogPath)) {
  console.error('FAIL: Catalog file public/data/games.json does not exist!');
  process.exit(1);
}

let catalog;
try {
  const content = fs.readFileSync(catalogPath, 'utf8');
  catalog = JSON.parse(content);
} catch (e) {
  console.error('FAIL: Catalog JSON parsing failed:', e.message);
  process.exit(1);
}

if (!Array.isArray(catalog) || catalog.length === 0) {
  console.error('FAIL: Catalog is empty or not an array!');
  process.exit(1);
}

console.log(`Found ${catalog.length} entries in catalog.`);

const requiredFields = [
  'id', 'title', 'category', 'description', 'instructions',
  'author', 'license', 'sourceUrl', 'controls', 'tags',
  'thumbnail', 'thumbnailStatus', 'isExternal', 'offlineAvailable'
];

const validCategories = ['arcade', 'puzzle', 'action', 'board', 'casual'];
const seenIds = new Set();
let hasErrors = false;

for (let i = 0; i < catalog.length; i++) {
  const game = catalog[i];
  const prefix = `[Game ${i + 1}: ${game.id || 'NO_ID'}]`;

  // 1. Required fields
  for (const field of requiredFields) {
    if (game[field] === undefined || game[field] === null || (typeof game[field] === 'string' && game[field].trim() === '')) {
      console.error(`${prefix} FAIL: Missing or empty required field '${field}'`);
      hasErrors = true;
    }
  }

  // 2. ID uniqueness & format
  if (game.id) {
    if (seenIds.has(game.id)) {
      console.error(`${prefix} FAIL: Duplicate game ID '${game.id}'`);
      hasErrors = true;
    }
    seenIds.add(game.id);

    if (!/^[a-z0-9-]+$/.test(game.id)) {
      console.error(`${prefix} FAIL: Game ID '${game.id}' must be lowercase alphanumeric with hyphens`);
      hasErrors = true;
    }
  }

  // 3. Category validation
  if (game.category && !validCategories.includes(game.category.toLowerCase())) {
    console.error(`${prefix} FAIL: Invalid category '${game.category}'. Must be one of: ${validCategories.join(', ')}`);
    hasErrors = true;
  }

  // 4. URL validation
  if (game.isExternal) {
    if (!game.embedUrl || !game.embedUrl.startsWith('https://')) {
      console.error(`${prefix} FAIL: External game must have a secure HTTPS 'embedUrl'`);
      hasErrors = true;
    }
  } else {
    if (!game.localUrl) {
      console.error(`${prefix} FAIL: Local game must have 'localUrl'`);
      hasErrors = true;
    } else {
      const localFilePath = path.join(publicDir, game.localUrl.replace(/^\//, ''));
      if (!fs.existsSync(localFilePath)) {
        console.error(`${prefix} FAIL: Local game file does not exist on disk: ${localFilePath}`);
        hasErrors = true;
      }
    }
  }

  // 5. Thumbnail validation
  if (game.thumbnail) {
    const thumbFilePath = path.join(publicDir, game.thumbnail.replace(/^\//, ''));
    if (!fs.existsSync(thumbFilePath)) {
      console.error(`${prefix} FAIL: Thumbnail file does not exist on disk: ${thumbFilePath}`);
      hasErrors = true;
    }
  } else {
    console.error(`${prefix} FAIL: Missing thumbnail!`);
    hasErrors = true;
  }

  // 6. Source repo validation
  if (game.sourceUrl && !game.sourceUrl.startsWith('https://')) {
    console.error(`${prefix} FAIL: sourceUrl must be a valid HTTPS URL`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\nFAIL: Catalog validation failed with errors!');
  process.exit(1);
} else {
  console.log(`\nSUCCESS: All ${catalog.length} games in catalog validated successfully!`);
}
