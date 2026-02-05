require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: "0.8.20",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    devnet: {
      url: process.env.RPC_URL,
      chainId: Number(process.env.CHAIN_ID),
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};
