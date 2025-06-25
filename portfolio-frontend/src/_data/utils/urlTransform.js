/**
 * Transform Strapi URLs to local static URLs
 * This converts http://strapi:1337/uploads/filename.jpg to /uploads/filename.jpg
 */

const STRAPI_BASE_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';

function transformToLocalUrl(url) {
  if (!url) return null;
  
  // If it's already a local URL, return as-is
  if (url.startsWith('/')) return url;
  
  // If it contains the Strapi base URL, replace it with local path
  if (url.includes('/uploads/')) {
    const filename = url.split('/uploads/')[1];
    return `/uploads/${filename}`;
  }
  
  // If it's a full Strapi URL, extract the path
  if (url.startsWith(STRAPI_BASE_URL)) {
    return url.replace(STRAPI_BASE_URL, '');
  }
  
  // For any other Strapi-like URLs, try to extract uploads path
  const uploadsMatch = url.match(/\/uploads\/(.+)$/);
  if (uploadsMatch) {
    return `/uploads/${uploadsMatch[1]}`;
  }
  
  // If we can't transform it, return the original URL
  return url;
}

function transformMediaObject(mediaObj) {
  if (!mediaObj) return null;
  
  return {
    ...mediaObj,
    url: transformToLocalUrl(mediaObj.url),
    medium: mediaObj.medium ? transformToLocalUrl(mediaObj.medium) : null
  };
}

function transformMediaArray(mediaArray) {
  if (!Array.isArray(mediaArray)) return [];
  
  return mediaArray.map(transformMediaObject).filter(Boolean);
}

module.exports = {
  transformToLocalUrl,
  transformMediaObject,
  transformMediaArray
};
