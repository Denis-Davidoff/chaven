import { expect } from "chai";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const IPFS_JSON_PATH = path.resolve(__dirname, "..", "metadata", "ipfs.json");

// Deterministic fake IPFS upload: returns ipfs://Qm<keccak256(content)>
function mockIpfsUpload(content: string): string {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(content)).slice(2);
  return `ipfs://Qm${hash}`;
}

async function deployMarketplace() {
  const Factory = await ethers.getContractFactory("NFTMarketplace");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  return contract;
}

describe("NFTMarketplace", () => {
  it("deploys with correct name and symbol", async () => {
    const contract = await deployMarketplace();
    expect(await contract.name()).to.equal("NFTMarketplace");
    expect(await contract.symbol()).to.equal("NFTM");
  });

  it("returns the default list price", async () => {
    const contract = await deployMarketplace();
    expect(await contract.getListPrice()).to.equal(ethers.parseEther("0.01"));
  });

  describe("createToken with simulated IPFS metadata", () => {
    it("parses metadata/ipfs.json and produces a deterministic mock CID", () => {
      const raw = fs.readFileSync(IPFS_JSON_PATH, "utf-8");
      const metadata = JSON.parse(raw);
      expect(metadata).to.have.property("name");
      expect(metadata).to.have.property("image");
      expect(metadata.image as string).to.match(/^ipfs:\/\//);

      const tokenURI = mockIpfsUpload(raw);
      expect(tokenURI).to.match(/^ipfs:\/\/Qm[0-9a-f]{64}$/);
      expect(mockIpfsUpload(raw)).to.equal(tokenURI);
    });

    it("mints a token storing the mock IPFS tokenURI", async () => {
      const contract = await deployMarketplace();
      const [, seller] = await ethers.getSigners();

      const raw = fs.readFileSync(IPFS_JSON_PATH, "utf-8");
      const tokenURI = mockIpfsUpload(raw);

      const listPrice = await contract.getListPrice();
      const salePrice = ethers.parseEther("0.05");

      await expect(
        contract.connect(seller).createToken(tokenURI, salePrice, { value: listPrice }),
      ).to.emit(contract, "TokenListedSuccess");

      expect(await contract.getCurrentToken()).to.equal(1n);
      expect(await contract.tokenURI(1)).to.equal(tokenURI);

      const listed = await contract.getLatestIdToListedToken();
      expect(listed.tokenId).to.equal(1n);
      expect(listed.master).to.equal(seller.address);
      expect(listed.owner).to.equal(seller.address);
      expect(listed.seller).to.equal(seller.address);
      expect(listed.price).to.equal(salePrice);
      expect(listed.currentlyListed).to.equal(true);
    });

    it("reverts createToken when the listing fee is not paid", async () => {
      const contract = await deployMarketplace();
      const tokenURI = mockIpfsUpload("placeholder");
      await expect(
        contract.createToken(tokenURI, ethers.parseEther("0.05")),
      ).to.be.revertedWith("Hopefully sending the correct price");
    });
  });
});
