require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: "0.8.19",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    tanenbaum: {
      url: "https://rpc.tanenbaum.io",
      chainId: 5700,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};
