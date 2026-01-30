async function main() {
  console.log("Deploying Syspoints...");

  const Syspoints = await ethers.getContractFactory("Syspoints");
  const syspoints = await Syspoints.deploy();

  console.log("Waiting for confirmations...");

  await syspoints.waitForDeployment();

  console.log("Syspoints deployed to:", await syspoints.getAddress());
}