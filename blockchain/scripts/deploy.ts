import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ResQNet Protocol contracts...");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ── 1. Deploy ProofOfRelief NFT ──────────────────────────────────────────
  console.log("1/3  Deploying ProofOfRelief (ERC-721 soulbound)...");
  const POR = await ethers.getContractFactory("ProofOfRelief");
  const por = await POR.deploy(deployer.address);
  await por.waitForDeployment();
  const porAddress = await por.getAddress();
  console.log("     ProofOfRelief deployed at:", porAddress);

  // ── 2. Deploy MissionRegistry ────────────────────────────────────────────
  console.log("2/3  Deploying MissionRegistry...");
  const MR = await ethers.getContractFactory("MissionRegistry");
  const registry = await MR.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("     MissionRegistry deployed at:", registryAddress);

  // Wire: give MissionRegistry minting rights on ProofOfRelief
  console.log("     Granting minter role to MissionRegistry...");
  await (await por.setMinter(registryAddress, true)).wait();

  // Wire: give MissionRegistry address to registry
  console.log("     Setting PoR contract on MissionRegistry...");
  await (await registry.setPorContract(porAddress)).wait();

  // ── 3. Deploy PaymentChannel ─────────────────────────────────────────────
  console.log("3/3  Deploying PaymentChannel...");
  const PC = await ethers.getContractFactory("PaymentChannel");
  const paymentChannel = await PC.deploy();
  await paymentChannel.waitForDeployment();
  const pcAddress = await paymentChannel.getAddress();
  console.log("     PaymentChannel deployed at:", pcAddress);

  // ── Persist deployment info ───────────────────────────────────────────────
  const deployment = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      ProofOfRelief: porAddress,
      MissionRegistry: registryAddress,
      PaymentChannel: pcAddress,
    },
  };

  const dir = join(__dirname, "../deployments");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, `${network.name}.json`);
  writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log("\nDeployment info saved to:", file);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log(" ResQNet Protocol – Deployment Complete");
  console.log("══════════════════════════════════════════════════");
  console.log(" ProofOfRelief  :", porAddress);
  console.log(" MissionRegistry:", registryAddress);
  console.log(" PaymentChannel :", pcAddress);
  console.log("══════════════════════════════════════════════════\n");

  // Quick smoke-test on local/hardhat network
  if (network.name === "localhost" || network.name === "hardhat") {
    console.log("Running quick smoke test...");

    // Create a mission
    const tx = await registry.createMission(
      "Building B, Sector 7",
      BigInt(1234567),
      BigInt(9876543),
      1, // Food
      "Rice bags",
      "5 SOS detected, nearest supply hub has rice, volunteer available.",
      { value: ethers.parseEther("0.01") }
    );
    await tx.wait();
    const mission = await registry.getMission(1);
    console.log("  Created mission #1:", mission.location, "– status:", mission.status.toString());

    // Open a payment channel
    const [, recipient] = await ethers.getSigners();
    const pcTx = await paymentChannel
      .connect(deployer)
      .openChannel(recipient.address, 3600, { value: ethers.parseEther("0.1") });
    await pcTx.wait();
    console.log("  Opened payment channel #1 → recipient:", recipient.address);

    console.log("Smoke test passed.\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
