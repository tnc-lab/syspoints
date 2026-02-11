const { requireEnv } = require('./env');
const ethers = require('ethers');

function getSyscoinConfig() {
  const rpcUrl = requireEnv('RPC_URL');
  const chainId = requireEnv('CHAIN_ID');
  const privateKey = requireEnv('PRIVATE_KEY');
  const contractAddress = requireEnv('CONTRACT_ADDRESS');

  return {
    rpcUrl,
    chainId: Number(chainId),
    privateKey,
    contractAddress,
  };
}

function createProvider() {
  const { rpcUrl, chainId } = getSyscoinConfig();
  if (ethers.providers && ethers.providers.JsonRpcProvider) {
    return new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
  }
  return new ethers.JsonRpcProvider(rpcUrl, chainId);
}

function createSigner() {
  const provider = createProvider();
  const { privateKey } = getSyscoinConfig();
  if (ethers.Wallet) {
    return new ethers.Wallet(privateKey, provider);
  }
  return new ethers.Wallet(privateKey, provider);
}

module.exports = {
  getSyscoinConfig,
  createProvider,
  createSigner,
};
