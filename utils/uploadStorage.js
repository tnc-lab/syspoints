const path = require('path');

function getUploadsBaseDir() {
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }
  if (process.env.VERCEL) {
    return '/tmp/uploads';
  }
  return path.join(process.cwd(), 'uploads');
}

function getUploadDir(scope) {
  return path.join(getUploadsBaseDir(), scope);
}

function buildPublicUploadUrl(req, scope, fileName) {
  return `${req.protocol}://${req.get('host')}/uploads/${scope}/${fileName}`;
}

module.exports = {
  getUploadsBaseDir,
  getUploadDir,
  buildPublicUploadUrl,
};
