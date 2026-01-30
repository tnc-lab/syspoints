const readline = require("readline");

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question) =>
    new Promise((resolve) => rl.question(question, resolve));

  // 1. Obtener usuario
  const [user] = await ethers.getSigners();

  console.log("\nConnected wallet:", user.address);

  // 2. Conectar contrato
  const Syspoints = await ethers.getContractFactory("Syspoints");
  const syspoints = await Syspoints.attach(
    "0xe75Dbd09c87de5548bCf135619f1ad1F304F22DF"
  );

  // 3. Inputs del usuario
  const entityName = await ask(
    "\nIngrese el nombre de la tienda, empresa o establecimiento: (e.g. Falabella-PE): "
  );

  const reviewText = await ask(
    "Escribe tu comentario y/o experiencia de compra: "
  );

  rl.close();

  // 4. Crear hashes
  const entityId = ethers.keccak256(
    ethers.toUtf8Bytes(entityName)
  );

  const reviewHash = ethers.keccak256(
    ethers.toUtf8Bytes(reviewText)
  );

  console.log("\nSubmitting review to blockchain...");

  // 5. Enviar transacción
  const tx = await syspoints.submitReview(entityId, reviewHash);
  const receipt = await tx.wait();

  // 6. Resultados
  const points = await syspoints.reputation(user.address);
  const reviewId = receipt.logs[0].args.reviewId;

  console.log("\n✅ Review successfully recorded");
  console.log("🆔 Review ID:", reviewId.toString());
  console.log("⭐ Points earned:", points.toString());
  console.log("🔗 Transaction hash:", receipt.hash);
  console.log("⛓️  Block number:", receipt.blockNumber);

  console.log("\nEste comentario ahora está anclada en la cadena de bloques.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
