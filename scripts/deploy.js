const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying with:", deployer.address);

  // Deploy SYSPT
  const SYSPT = await hre.ethers.getContractFactory("SYSPT");
  const sysptToken = await SYSPT.deploy();
  await sysptToken.waitForDeployment();

  console.log("✅ SYSPT deployed to:", await sysptToken.getAddress());

  // Deploy Syspoints
  const Syspoints = await hre.ethers.getContractFactory("Syspoints");
  const syspoints = await Syspoints.deploy(
    await sysptToken.getAddress()
  );
  await syspoints.waitForDeployment();

  console.log("✅ Syspoints deployed to:", await syspoints.getAddress());

  // Transferencia de ownership para Syspoints
  const tx = await sysptToken.transferOwnership(
    await syspoints.getAddress()
  );
  await tx.wait();

  console.log("Ownership of SYSPT transferred to Syspoints.");
}

main().catch((error) => {
  console.error("❌ Deploy failed:", error);
  process.exitCode = 1;
});