const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Syspoints contract...");

  const Syspoints = await hre.ethers.getContractFactory("Syspoints");
  const syspoints = await Syspoints.deploy();

  await syspoints.waitForDeployment();

  console.log("✅ Syspoints deployed to:", await syspoints.getAddress());
}

main().catch((error) => {
  console.error("❌ Deploy failed:", error);
  process.exitCode = 1;
});