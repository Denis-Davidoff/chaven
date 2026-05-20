import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// deployments/<env>.json format:
//   { "contractAddress": "0x...", "ipfsTokenURI": "ipfs://..." }
type Deployment = { contractAddress?: string; ipfsTokenURI?: string };

function readDeployment(): { file: string; data: Deployment } {
  const envName = process.env.HARDHAT_ENV === "prod" ? "prod" : "dev";
  const file = path.resolve(__dirname, "..", "deployments", `${envName}.json`);
  if (!fs.existsSync(file)) return { file, data: {} };
  const raw = fs.readFileSync(file, "utf-8").trim();
  if (!raw) return { file, data: {} };
  return { file, data: JSON.parse(raw) as Deployment };
}

async function main() {
  const { file: deploymentFile, data: deployment } = readDeployment();

  const contractAddress = process.env.CONTRACT_ADDRESS ?? deployment.contractAddress;
  if (!contractAddress) {
    throw new Error(
      `No contract address: set CONTRACT_ADDRESS env or add "contractAddress" to ${deploymentFile} (run npm run deploy:* first)`,
    );
  }

  const tokenURI = process.env.TOKEN_URI ?? deployment.ipfsTokenURI;
  if (!tokenURI) {
    throw new Error(
      `No token URI: set TOKEN_URI env or add "ipfsTokenURI" to ${deploymentFile} (run npm run ipfs:* first)`,
    );
  }

  const salePriceEth = process.env.SALE_PRICE ?? "0.05";
  const salePrice = ethers.parseEther(salePriceEth);

  const [signer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  console.log(`Network:    ${network.name} (chainId=${net.chainId})`);
  console.log(`Signer:     ${signer.address}`);
  console.log(
    `Balance:    ${ethers.formatEther(await ethers.provider.getBalance(signer.address))} ETH`,
  );
  console.log(`Deployment: ${path.relative(process.cwd(), deploymentFile)}`);
  console.log(`Contract:   ${contractAddress}`);
  console.log(`Token URI:  ${tokenURI}`);

  const contract = await ethers.getContractAt("NFTMarketplace", contractAddress);
  const listPrice = await contract.getListPrice();
  console.log(
    `listPrice=${ethers.formatEther(listPrice)} ETH, salePrice=${ethers.formatEther(salePrice)} ETH`,
  );

  const tx = await contract.createToken(tokenURI, salePrice, { value: listPrice });
  console.log(`Mint tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Mint confirmed in block ${receipt?.blockNumber}`);
  console.log(`Current tokenId: ${await contract.getCurrentToken()}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
