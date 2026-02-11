const { query } = require('../db');
const { getCurrentConfig, updateConfig } = require('../repositories/pointsConfigRepository');

async function getPointsConfig() {
  return getCurrentConfig({ query });
}

async function setPointsConfig(payload) {
  return updateConfig({ query }, payload);
}

module.exports = {
  pointsConfigService: {
    getPointsConfig,
    setPointsConfig,
  },
};
