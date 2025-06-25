 const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { createCanvas } = require('canvas');
const fetch = require('node-fetch');

// Dynamic import for PDF.js ES module
let pdfjsLib = null;
const loadPdfjs = async () => {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
};

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
function generatePdfHash(pdfUrl, lastModified) {
  // Include last modified date in hash to invalidate cache when file changes
  return crypto.createHash('md5').update(`${pdfUrl}-${lastModified || ''}`).digest('hex');
}

// Delete directory recursively
async function deleteDirectory(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    await Promise.all(files.map(async (file) => {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await deleteDirectory(filePath);
      } else {
        await fs.unlink(filePath);
      }
    }));
    await fs.rmdir(dirPath);
    console.log(`Deleted cache directory: ${dirPath}`);
  } catch (error) {
    console.error(`Error deleting directory ${dirPath}:`, error);
  }
}

// Convert PDF to images
async function convertPdfToImages(pdfUrl, fileMetadata = {}) {
  await ensureCacheDir();
  
  const pdfHash = generatePdfHash(pdfUrl, fileMetadata.updatedAt);
  const cacheDir = path.join(CACHE_DIR, pdfHash);
  const metadataPath = path.join(cacheDir, 'metadata.json');
  
  // Check if already cached
  try {
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    
    // Check if the cached version is up to date
    if (metadata.pages && metadata.pages.length >= 4) {
      // If we have a last modified date, check if it matches
      if (fileMetadata.updatedAt && metadata.fileUpdatedAt !== fileMetadata.updatedAt) {
        console.log(`PDF has been updated, invalidating cache for: ${pdfUrl}`);
        // Delete old cache directory
        await deleteDirectory(cacheDir);
      } else {
        console.log(`Using cached PDF images for: ${pdfUrl}`);
        return metadata;
      }
    }
  } catch (e) {
    // Cache miss or invalid, continue with conversion
  }
  
  // Clean up any old cache directories for this PDF
  try {
    const allDirs = await fs.readdir(CACHE_DIR);
    for (const dir of allDirs) {
      if (dir !== pdfHash) {
        const dirPath = path.join(CACHE_DIR, dir);
        try {
          const metadata = JSON.parse(await fs.readFile(path.join(dirPath, 'metadata.json'), 'utf8'));
          if (metadata.pdfUrl === pdfUrl) {
            console.log(`Found old cache for same PDF, removing: ${dirPath}`);
            await deleteDirectory(dirPath);
          }
        } catch (e) {
          // Skip if can't read metadata
        }
      }
    }
  } catch (e) {
    console.error('Error cleaning up old cache:', e);
  }
  
  console.log(`Converting PDF to images: ${pdfUrl}`);
  
  try {
    // Load PDF.js dynamically
    const pdfjs = await loadPdfjs();
    
    // Fetch the PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    
    const pdfData = await response.arrayBuffer();
    
    // Load the PDF
    const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
    const numPages = pdf.numPages;
    
    // Validate minimum pages
    if (numPages < 4) {
      throw new Error(`PDF must have at least 4 pages. Found: ${numPages} pages`);
    }
    
    // Create cache directory
    await fs.mkdir(cacheDir, { recursive: true });
    
    const pages = [];
    let aspectRatio = null;
    
    // Convert each page to image
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher quality
      
      // Store aspect ratio from first page
      if (!aspectRatio) {
        aspectRatio = viewport.width / viewport.height;
      }
      
      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Save as JPEG
      const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
      const filename = `page-${pageNum}.jpg`;
      const filepath = path.join(cacheDir, filename);
      
      await fs.writeFile(filepath, buffer);
      
      pages.push({
        pageNumber: pageNum,
        filename: filename,
        width: viewport.width,
        height: viewport.height,
        path: filepath
      });
    }
    
    // Save metadata
    const metadata = {
      pdfUrl: pdfUrl,
      numPages: numPages,
      aspectRatio: aspectRatio,
      pages: pages,
      convertedAt: new Date().toISOString(),
      fileUpdatedAt: fileMetadata.updatedAt || null
    };
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    return metadata;
  } catch (error) {
    console.error('Error converting PDF:', error);
    throw error;
  }
}

module.exports = {
  convertPdfToImages,
  CACHE_DIR
};
