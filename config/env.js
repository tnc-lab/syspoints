function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name) {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

module.exports = {
  requireEnv,
  getOptionalEnv,
};
