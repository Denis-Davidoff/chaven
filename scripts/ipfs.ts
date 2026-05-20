import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

const ENV = process.env.HARDHAT_ENV === "prod" ? "prod" : "dev";
dotenv.config({ path: path.resolve(__dirname, "..", `.env.${ENV}`) });

const IPFS_JSON_PATH = path.resolve(__dirname, "..", "metadata", "ipfs.json");

async function pinJsonToIpfs(jsonPath: string, jwt: string): Promise<string> {
  const content = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataMetadata: { name: path.basename(jsonPath) },
      pinataContent: content,
    }),
  });
  if (!res.ok) {
    throw new Error(`Pinata responded ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { IpfsHash: string };
  return `ipfs://${data.IpfsHash}`;
}

async function main() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error(`PINATA_JWT not set in .env.${ENV}`);
  }

  console.log(`Env:    ${ENV}`);
  console.log(`Source: ${path.relative(process.cwd(), IPFS_JSON_PATH)}`);
  console.log(`Uploading to Pinata...`);

  const tokenURI = await pinJsonToIpfs(IPFS_JSON_PATH, jwt);

  console.log(`\ntokenURI: ${tokenURI}`);
  console.log(`\nAdd to deployments/${ENV}.json:`);
  console.log(`  "ipfsTokenURI": "${tokenURI}"`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
