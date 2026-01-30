async function main() {
  const Syspoints = await ethers.getContractFactory("Syspoints");
  const syspoints = await Syspoints.deploy();

  await syspoints.waitForDeployment();

  console.log("Syspoints deployed to:", await syspoints.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});