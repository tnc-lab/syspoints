const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying SyspointsReviews contract...");

  const SyspointsReviews = await hre.ethers.getContractFactory("SyspointsReviews");
  const syspoints = await SyspointsReviews.deploy();

  await syspoints.waitForDeployment();

  console.log("✅ Syspoints deployed to:", await syspoints.getAddress());
}

main().catch((error) => {
  console.error("❌ Deploy failed:", error);
  process.exitCode = 1;
});
