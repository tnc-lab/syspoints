const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { getUploadDir, buildPublicUploadUrl } = require('../utils/uploadStorage');

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    folderRoot: process.env.CLOUDINARY_FOLDER || 'syspoints',
  };
}

async function uploadToCloudinary({ scope, fileName, dataUrl, cloudinary }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `${cloudinary.folderRoot}/${scope}`;
  const publicId = String(fileName || 'asset')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .slice(0, 120) || `asset-${timestamp}`;

  const signatureBase = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${cloudinary.apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureBase).digest('hex');

  const body = new URLSearchParams({
    file: dataUrl,
    api_key: cloudinary.apiKey,
    timestamp: String(timestamp),
    signature,
    folder,
    public_id: publicId,
  });

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.secure_url) {
    const detail = payload?.error?.message || `Cloudinary upload failed with status ${response.status}`;
    throw new Error(detail);
  }

  return payload.secure_url;
}

async function uploadImageDataUrl(req, { scope, fileName, dataUrl, buffer }) {
  const cloudinary = getCloudinaryConfig();
  if (cloudinary) {
    return uploadToCloudinary({ scope, fileName, dataUrl, cloudinary });
  }

  const uploadDir = getUploadDir(scope);
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, fileName), buffer);
  return buildPublicUploadUrl(req, scope, fileName);
}

module.exports = {
  uploadImageDataUrl,
};
