import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  console.log(`Network:  ${network.name} (chainId=${net.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`,
  );

  const Factory = await ethers.getContractFactory("NFTMarketplace");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\nNFTMarketplace deployed at: ${address}`);
  if (network.name !== "hardhat") {
    const envName = process.env.HARDHAT_ENV === "prod" ? "prod" : "dev";
    console.log(`\nAdd to deployments/${envName}.json:`);
    console.log(`  "contractAddress": "${address}"`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
