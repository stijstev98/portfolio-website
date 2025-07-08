const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { Poppler } = require('node-poppler');

// Cache directory for processed PDFs
const CACHE_DIR = path.join(process.cwd(), '.cache', 'pdf-images');

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating cache directory:', err);
  }
}

// Generate a hash for the PDF file to use as cache key
function generatePdfHash(pdfIdentifier, lastModified) {
  return crypto.createHash('md5').update(`${pdfIdentifier}-${lastModified || ''}`).digest('hex');
}

// Delete directory recursively
async function deleteDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Error deleting directory ${dirPath}:`, err);
    }
  }
}

async function convertPdfToImages(pdfIdentifier, lastModified) {
  await ensureCacheDir();
  const isUrl = pdfIdentifier.startsWith('http');
  const pdfHash = generatePdfHash(pdfIdentifier, lastModified);
  const pdfCachePath = path.join(CACHE_DIR, pdfHash);
  const infoFilePath = path.join(pdfCachePath, 'info.json');

  try {
    const infoFileContent = await fs.readFile(infoFilePath, 'utf-8');
    const { images } = JSON.parse(infoFileContent);
    const allImagesExist = await Promise.all(images.map(img => fs.access(path.join(process.cwd(), img)).then(() => true).catch(() => false))).then(results => results.every(r => r));
    if (allImagesExist) {
        return images;
    }
    console.log(`Cache for ${pdfIdentifier} is incomplete. Re-processing...`);
  } catch (error) {
    // Not cached or info file is invalid, proceed with conversion
  }

  await deleteDirectory(pdfCachePath);
  await fs.mkdir(pdfCachePath, { recursive: true });

  const tempPdfPath = path.join(pdfCachePath, 'temp.pdf');

  try {
    if (isUrl) {
      const response = await fetch(pdfIdentifier);
      if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      const pdfBuffer = await response.buffer();
      await fs.writeFile(tempPdfPath, pdfBuffer);
    } else {
      await fs.copyFile(pdfIdentifier, tempPdfPath);
    }

    const poppler = new Poppler();
    const options = {
      jpegFile: true,
    };
    const outputFilePrefix = path.join(pdfCachePath, 'page');

    await poppler.pdfToCairo(tempPdfPath, outputFilePrefix, options);
    console.log(`Successfully converted ${pdfIdentifier} to images.`);

    const files = await fs.readdir(pdfCachePath);
    const images = files
      .filter((file) => file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg'))
      .map((file) => path.join('/pdf-cache', pdfHash, file));

    await fs.writeFile(infoFilePath, JSON.stringify({ source: pdfIdentifier, images }));

    return images;
  } catch (error) {
    console.error(`Failed to process PDF ${pdfIdentifier}:`, error);
    await deleteDirectory(pdfCachePath);
    return [];
  } finally {
    await deleteDirectory(tempPdfPath).catch(()=>{});
  }
}

module.exports = {
  convertPdfToImages,
  CACHE_DIR,
};
