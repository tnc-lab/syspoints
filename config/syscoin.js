const { requireEnv } = require('./env');
const { providers, Wallet } = require('ethers');

function getSyscoinConfig() {
  const rpcUrl = requireEnv('RPC_URL');
  const chainId = requireEnv('CHAIN_ID');
  const privateKey = requireEnv('PRIVATE_KEY');

  return {
    rpcUrl,
    chainId: Number(chainId),
    privateKey,
  };
}

function createProvider() {
  const { rpcUrl, chainId } = getSyscoinConfig();
  return new providers.JsonRpcProvider(rpcUrl, chainId);
}

function createSigner() {
  const provider = createProvider();
  const { privateKey } = getSyscoinConfig();
  return new Wallet(privateKey, provider);
}

module.exports = {
  getSyscoinConfig,
  createProvider,
  createSigner,
};
