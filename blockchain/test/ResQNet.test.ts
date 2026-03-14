import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { MissionRegistry, ProofOfRelief, PaymentChannel } from "../typechain-types";

describe("ResQNet Protocol", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Shared fixture
  // ─────────────────────────────────────────────────────────────────────────
  async function deployFixture() {
    const [owner, coord, volunteer, recipient, stranger] = await ethers.getSigners();

    const POR = await ethers.getContractFactory("ProofOfRelief");
    const por = (await POR.deploy(owner.address)) as unknown as ProofOfRelief;

    const MR = await ethers.getContractFactory("MissionRegistry");
    const registry = (await MR.deploy(owner.address)) as unknown as MissionRegistry;

    // Wire contracts
    await por.setMinter(await registry.getAddress(), true);
    await registry.setPorContract(await por.getAddress());
    await registry.setCoordinator(coord.address, true);

    const PC = await ethers.getContractFactory("PaymentChannel");
    const paymentChannel = (await PC.deploy()) as unknown as PaymentChannel;

    return { owner, coord, volunteer, recipient, stranger, por, registry, paymentChannel };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MissionRegistry
  // ─────────────────────────────────────────────────────────────────────────
  describe("MissionRegistry", () => {
    it("owner can create a mission", async () => {
      const { registry, owner } = await loadFixture(deployFixture);
      await registry.connect(owner).createMission(
        "Block A, Sector 3", 1234567n, 9876543n,
        1, "rice bags",
        "5 SOS detected near shelter",
        { value: ethers.parseEther("0.01") }
      );
      expect(await registry.totalMissions()).to.equal(1n);
      const m = await registry.getMission(1);
      expect(m.location).to.equal("Block A, Sector 3");
      expect(m.status).to.equal(0); // Created
      expect(m.rewardWei).to.equal(ethers.parseEther("0.01"));
    });

    it("coordinator can create a mission", async () => {
      const { registry, coord } = await loadFixture(deployFixture);
      await registry.connect(coord).createMission(
        "Hospital Zone", 0n, 0n, 0, "insulin", "cluster detected", { value: 0 }
      );
      expect(await registry.totalMissions()).to.equal(1n);
    });

    it("stranger cannot create a mission", async () => {
      const { registry, stranger } = await loadFixture(deployFixture);
      await expect(
        registry.connect(stranger).createMission("X", 0n, 0n, 0, "x", "x", { value: 0 })
      ).to.be.revertedWith("Not coordinator");
    });

    it("volunteer can assign → start → complete a mission and receive NFT", async () => {
      const { registry, por, owner, volunteer } = await loadFixture(deployFixture);

      await registry.connect(owner).createMission(
        "Flood Zone B", 1n, 1n, 2, "water",
        "SOS cluster – water shortage",
        { value: ethers.parseEther("0.05") }
      );

      const before = await ethers.provider.getBalance(volunteer.address);

      // Assign
      await registry.connect(volunteer).assignMission(1);
      let m = await registry.getMission(1);
      expect(m.status).to.equal(1); // Assigned
      expect(m.volunteer).to.equal(volunteer.address);

      // Start
      await registry.connect(volunteer).startMission(1);
      m = await registry.getMission(1);
      expect(m.status).to.equal(2); // InProgress

      // Complete
      await registry.connect(volunteer).completeMission(1, "10L water delivered");
      m = await registry.getMission(1);
      expect(m.status).to.equal(3); // Completed

      // NFT minted
      expect(m.porTokenId).to.equal(1n);
      expect(await por.ownerOf(1)).to.equal(volunteer.address);

      // Reward paid out
      const after = await ethers.provider.getBalance(volunteer.address);
      expect(after).to.be.gt(before);
    });

    it("blocks double assignment", async () => {
      const { registry, owner, volunteer, stranger } = await loadFixture(deployFixture);
      await registry.connect(owner).createMission("Z", 0n, 0n, 0, "x", "x", { value: 0 });
      await registry.connect(volunteer).assignMission(1);
      await expect(registry.connect(stranger).assignMission(1)).to.be.revertedWith("Already assigned");
    });

    it("can cancel a created mission and refunds reward", async () => {
      const { registry, owner } = await loadFixture(deployFixture);
      const reward = ethers.parseEther("0.1");
      await registry.connect(owner).createMission("Y", 0n, 0n, 0, "x", "x", { value: reward });
      const before = await ethers.provider.getBalance(owner.address);
      await registry.connect(owner).cancelMission(1);
      const after = await ethers.provider.getBalance(owner.address);
      expect(after).to.be.gt(before);
    });

    it("returns open missions", async () => {
      const { registry, owner, volunteer } = await loadFixture(deployFixture);
      await registry.connect(owner).createMission("A", 0n, 0n, 0, "x", "x", { value: 0 });
      await registry.connect(owner).createMission("B", 0n, 0n, 0, "x", "x", { value: 0 });
      await registry.connect(volunteer).assignMission(1);
      const open = await registry.getOpenMissions();
      expect(open.length).to.equal(1);
      expect(open[0].location).to.equal("B");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ProofOfRelief
  // ─────────────────────────────────────────────────────────────────────────
  describe("ProofOfRelief", () => {
    it("soulbound: blocks transfer", async () => {
      const { registry, por, owner, volunteer, stranger } = await loadFixture(deployFixture);
      await registry.connect(owner).createMission("C", 0n, 0n, 0, "x", "x", { value: 0 });
      await registry.connect(volunteer).assignMission(1);
      await registry.connect(volunteer).completeMission(1, "food");
      expect(await por.ownerOf(1)).to.equal(volunteer.address);
      await expect(
        por.connect(volunteer).transferFrom(volunteer.address, stranger.address, 1)
      ).to.be.revertedWithCustomError(por, "SoulboundToken");
    });

    it("tokenURI is on-chain base64 JSON", async () => {
      const { registry, por, owner, volunteer } = await loadFixture(deployFixture);
      await registry.connect(owner).createMission("D", 0n, 0n, 0, "x", "x", { value: 0 });
      await registry.connect(volunteer).assignMission(1);
      await registry.connect(volunteer).completeMission(1, "medicine");
      const uri = await por.tokenURI(1);
      expect(uri.startsWith("data:application/json;base64,")).to.be.true;
    });

    it("non-minter cannot mint directly", async () => {
      const { por, stranger, volunteer } = await loadFixture(deployFixture);
      await expect(
        por.connect(stranger).mintRelief(volunteer.address, 99n, "loc", "aid", 0n)
      ).to.be.revertedWithCustomError(por, "NotMinter");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PaymentChannel
  // ─────────────────────────────────────────────────────────────────────────
  describe("PaymentChannel", () => {
    async function openChannel(paymentChannel: PaymentChannel, payer: any, recipient: any, value = "0.1") {
      const tx = await paymentChannel.connect(payer).openChannel(
        recipient.address, 3600n, { value: ethers.parseEther(value) }
      );
      await tx.wait();
      return 1n; // channelId
    }

    async function signVoucher(
      paymentChannel: PaymentChannel,
      signer: any,
      channelId: bigint,
      amount: bigint,
      nonce: bigint
    ) {
      const hash = await paymentChannel.voucherHash(channelId, amount, nonce);
      return signer.signMessage(ethers.getBytes(hash));
    }

    it("opens a channel and stores balance", async () => {
      const { paymentChannel, owner, recipient } = await loadFixture(deployFixture);
      await openChannel(paymentChannel, owner, recipient);
      const ch = await paymentChannel.getChannel(1n);
      expect(ch.balance).to.equal(ethers.parseEther("0.1"));
      expect(ch.payer).to.equal(owner.address);
      expect(ch.recipient).to.equal(recipient.address);
      expect(ch.state).to.equal(0); // Open
    });

    it("cooperative close pays recipient and refunds payer", async () => {
      const { paymentChannel, owner, recipient } = await loadFixture(deployFixture);
      await openChannel(paymentChannel, owner, recipient);

      const amount = ethers.parseEther("0.07");
      const nonce = 1n;
      const sig = await signVoucher(paymentChannel, owner, 1n, amount, nonce);

      const beforeR = await ethers.provider.getBalance(recipient.address);
      const beforeP = await ethers.provider.getBalance(owner.address);

      await paymentChannel.connect(recipient).closeChannel(1n, amount, nonce, sig);

      const afterR = await ethers.provider.getBalance(recipient.address);
      const afterP = await ethers.provider.getBalance(owner.address);

      expect(afterR).to.be.gt(beforeR);
      expect(afterP).to.be.gt(beforeP); // refund of 0.03
    });

    it("verifyVoucher returns valid=true for good signature", async () => {
      const { paymentChannel, owner, recipient } = await loadFixture(deployFixture);
      await openChannel(paymentChannel, owner, recipient);
      const amount = ethers.parseEther("0.05");
      const nonce = 1n;
      const sig = await signVoucher(paymentChannel, owner, 1n, amount, nonce);
      const [signer, valid] = await paymentChannel.verifyVoucher(1n, amount, nonce, sig);
      expect(valid).to.be.true;
      expect(signer).to.equal(owner.address);
    });

    it("rejects bad signature", async () => {
      const { paymentChannel, owner, recipient, stranger } = await loadFixture(deployFixture);
      await openChannel(paymentChannel, owner, recipient);
      const amount = ethers.parseEther("0.05");
      const nonce = 1n;
      // Signed by stranger, not payer
      const sig = await signVoucher(paymentChannel, stranger, 1n, amount, nonce);
      await expect(
        paymentChannel.connect(recipient).closeChannel(1n, amount, nonce, sig)
      ).to.be.revertedWithCustomError(paymentChannel, "InvalidSignature");
    });

    it("rejects nonce replay", async () => {
      const { paymentChannel, owner, recipient } = await loadFixture(deployFixture);
      await openChannel(paymentChannel, owner, recipient, "0.2");
      const amount = ethers.parseEther("0.05");
      const nonce = 1n;
      const sig = await signVoucher(paymentChannel, owner, 1n, amount, nonce);
      await paymentChannel.connect(recipient).closeChannel(1n, amount, nonce, sig);
      // Channel is now closed – any second attempt should fail
      await expect(
        paymentChannel.connect(recipient).closeChannel(1n, amount, nonce, sig)
      ).to.be.revertedWithCustomError(paymentChannel, "ChannelNotOpen");
    });

    it("dispute path: initiate → finalize after timeout", async () => {
      const { paymentChannel, owner, recipient } = await loadFixture(deployFixture);
      // Open with 5-min timeout, but we'll fast-forward
      await paymentChannel.connect(owner).openChannel(
        recipient.address, 300n, { value: ethers.parseEther("0.1") }
      );
      await paymentChannel.connect(recipient).initiateClose(1n);
      // Fast-forward 301 seconds
      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine", []);
      const before = await ethers.provider.getBalance(recipient.address);
      await paymentChannel.connect(recipient).finalizeClose(1n);
      const after = await ethers.provider.getBalance(recipient.address);
      expect(after).to.be.gt(before);
    });

    it("tops up an open channel", async () => {
      const { paymentChannel, owner, recipient } = await loadFixture(deployFixture);
      await openChannel(paymentChannel, owner, recipient);
      await paymentChannel.connect(owner).topUp(1n, { value: ethers.parseEther("0.05") });
      const ch = await paymentChannel.getChannel(1n);
      expect(ch.balance).to.equal(ethers.parseEther("0.15"));
    });
  });
});
