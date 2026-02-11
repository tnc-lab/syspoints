const readline = require("readline");

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question) =>
    new Promise((resolve) => rl.question(question, resolve));

  const [user] = await ethers.getSigners();

  console.log("\nConnected wallet:", user.address);

  const SyspointsReviews = await ethers.getContractFactory("SyspointsReviews");
  const syspoints = await SyspointsReviews.attach(
    "0x8D5Cc4c77407A718bB1d86b0aaed7847db6835dD"
  );

  const establishmentIdInput = await ask(
    "\nIngrese el UUID del establecimiento: "
  );

  const reviewHashInput = await ask(
    "Ingrese el hash de la review (hex): "
  );

  rl.close();

  const establishmentId = ethers.keccak256(
    ethers.toUtf8Bytes(establishmentIdInput)
  );

  console.log("\nSubmitting review hash to blockchain...");

  const tx = await syspoints.anchorReview(user.address, reviewHashInput, establishmentId);
  const receipt = await tx.wait();

  console.log("\n✅ Review anchored");
  console.log("🔗 Transaction hash:", receipt.hash);
  console.log("⛓️  Block number:", receipt.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
