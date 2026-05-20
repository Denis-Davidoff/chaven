# CHAVEN

A minimal NFT marketplace built on top of an ERC-721 contract (`NFTMarketplace`), with Hardhat tooling, IPFS metadata pinning via Pinata, and two separate environments for testnet and mainnet.

- **dev:** Ethereum Sepolia (chainId `11155111`)
- **prod:** Base Mainnet (chainId `8453`)

Both environments share the same contract code, the same Etherscan V2 API key, and the same Pinata JWT — they differ only in RPC URLs, the wallet key, and the deployed addresses stored under `deployments/`.

---

## Repository layout

```
.
├── contracts/
│   └── NFTMarketplace.sol        Solidity 0.8.20, OpenZeppelin v4 (ERC721URIStorage)
├── scripts/
│   ├── deploy.ts                 Deploy NFTMarketplace and print the address
│   ├── ipfs.ts                   Upload metadata/ipfs.json to Pinata and print the CID
│   └── mint.ts                   Mint a token using address + tokenURI from deployments/<env>.json
├── test/
│   └── NFTMarketplace.test.ts    5 tests including IPFS-mock minting
├── metadata/
│   └── ipfs.json                 NFT metadata (OpenSea-compatible JSON)
├── deployments/
│   ├── dev.json                  { "contractAddress": "0x...", "ipfsTokenURI": "ipfs://..." } for Sepolia
│   └── prod.json                 Same shape for Base Mainnet
├── hardhat.config.ts             Networks, solc, Etherscan V2, dotenv loader
├── tsconfig.json
├── package.json
├── .env.dev.example              Copy to .env.dev and fill in
└── .env.prod.example             Copy to .env.prod and fill in
```

Generated directories (gitignored): `node_modules/`, `artifacts/`, `cache/`, `typechain-types/`.

---

## Prerequisites

- **Node.js** 18+ (uses the built-in `fetch`)
- A funded EVM wallet (private key) — Sepolia ETH for dev, Base ETH for prod
- A **Pinata** account with a JWT API key — https://app.pinata.cloud/developers/api-keys
- An **Etherscan V2** multichain API key — https://etherscan.io/myapikey (one key covers Sepolia and Base)

---

## Setup

```bash
git clone <repo-url>
cd chaven
npm install
```

Create the environment files from the templates and fill in your secrets:

```bash
cp .env.dev.example  .env.dev
cp .env.prod.example .env.prod
```

`.env.dev`:

```
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=0x<your_sepolia_wallet_key>
ETHERSCAN_API_KEY=<your_etherscan_v2_key>
PINATA_JWT=<your_pinata_jwt>
```

`.env.prod`:

```
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=0x<your_base_wallet_key>
ETHERSCAN_API_KEY=<your_etherscan_v2_key>
PINATA_JWT=<your_pinata_jwt>
```

Both `.env.dev` and `.env.prod` are in `.gitignore` and never committed.

### Getting tokens

- **Sepolia ETH (dev):** https://www.alchemy.com/faucets/ethereum-sepolia (free, no purchase)
- **Base ETH (prod):** bridge from L1 via https://bridge.base.org, or withdraw ETH directly to the **Base** network from Coinbase / Binance / Bybit / OKX

---

## Commands

All `npm run *:dev` commands set `HARDHAT_ENV=dev` and target Sepolia; all `*:prod` commands set `HARDHAT_ENV=prod` and target Base. The right `.env.{dev,prod}` file is auto-loaded by `hardhat.config.ts`.

| Command                            | What it does                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run compile`                  | Compile contracts and regenerate Typechain types                                             |
| `npm test`                         | Run the local test suite (in-memory Hardhat network)                                         |
| `npm run node`                     | Start a local Hardhat JSON-RPC node                                                          |
| `npm run clean`                    | Wipe `artifacts/`, `cache/`, `typechain-types/`                                              |
| `npm run deploy:dev`               | Deploy `NFTMarketplace` to Sepolia and print the address                                     |
| `npm run deploy:prod`              | Same, but to Base Mainnet                                                                    |
| `npm run ipfs:dev`                 | Upload `metadata/ipfs.json` to Pinata using `PINATA_JWT` from `.env.dev`                     |
| `npm run ipfs:prod`                | Same using `.env.prod`                                                                       |
| `npm run mint:dev`                 | Mint a token on Sepolia using `contractAddress` + `ipfsTokenURI` from `deployments/dev.json` |
| `npm run mint:prod`                | Same on Base, using `deployments/prod.json`                                                  |
| `npm run verify:dev -- <address>`  | Verify a Sepolia contract on Etherscan                                                       |
| `npm run verify:prod -- <address>` | Verify a Base contract on Basescan                                                           |

> The `--` after `verify:*` is required so npm forwards the address to `hardhat verify` instead of consuming it itself.

---

## Typical flow

Each stage is a separate, independently re-runnable command. Between stages you copy values from the script's stdout into `deployments/<env>.json` by hand — that file is committed to the repo and becomes the source of truth for the frontend and for re-mints.

### Dev (Sepolia)

```bash
# 1. Deploy the contract
npm run deploy:dev
# → logs `NFTMarketplace deployed at: 0xABC...`
#   Paste into deployments/dev.json:
#     { "contractAddress": "0xABC..." }

# 2. Upload metadata to IPFS via Pinata
npm run ipfs:dev
# → logs `tokenURI: ipfs://Qm...`
#   Paste into deployments/dev.json:
#     { "contractAddress": "0xABC...", "ipfsTokenURI": "ipfs://Qm..." }

# 3. Mint a token (reads contractAddress + ipfsTokenURI from deployments/dev.json)
npm run mint:dev

# 4. Verify the contract on Etherscan
npm run verify:dev -- 0xABC...
```

### Prod (Base Mainnet)

```bash
npm run deploy:prod     # → fill `contractAddress` in deployments/prod.json
npm run ipfs:prod       # → fill `ipfsTokenURI`    in deployments/prod.json
npm run mint:prod
npm run verify:prod -- 0xABC...
```

### Re-minting

Once `deployments/<env>.json` has both `contractAddress` and `ipfsTokenURI`, you can mint additional tokens at any time without redeploying or re-uploading:

```bash
npm run mint:prod
# Optional overrides:
#   CONTRACT_ADDRESS=0x... npm run mint:prod
#   TOKEN_URI=ipfs://Qm... npm run mint:prod
#   SALE_PRICE=0.1 npm run mint:prod
```

Env variables take precedence over the file. If either `contractAddress` or `ipfsTokenURI` is still missing, `mint.ts` fails fast with a message pointing to the missing field and the script that produces it.

---

## How environments are selected

`hardhat.config.ts` reads `HARDHAT_ENV` (`dev` or `prod`) and loads the corresponding `.env.<env>` file via `dotenv`. The npm scripts set this variable for you, so you do not normally need to export it manually.

| `HARDHAT_ENV`   | `.env` file loaded | Hardhat network | Deployment file         |
| --------------- | ------------------ | --------------- | ----------------------- |
| `dev` (default) | `.env.dev`         | `sepolia`       | `deployments/dev.json`  |
| `prod`          | `.env.prod`        | `base`          | `deployments/prod.json` |

---

## Contract notes

The `NFTMarketplace` contract:

- Inherits `ERC721URIStorage` (token metadata stored on-chain as the per-token IPFS URI).
- Charges a flat `listPrice` of `0.01 ETH` to list a new token (goes to the contract owner).
- The first call to `createToken(tokenURI, price)` mints token `#1` and immediately lists it.
- Uses **OpenZeppelin v4** (`Counters` library was removed in v5).
- Solidity `0.8.20`, optimizer enabled with `runs: 200`.

`ListedToken` struct fields: `tokenId`, `master`, `owner`, `seller`, `price`, `currentlyListed`. The `master` field is set to `msg.sender` on mint and is intended as a permanent reference to the original minter (useful for royalties or attribution).

---

## Metadata format (`metadata/ipfs.json`)

OpenSea-compatible NFT metadata:

```json
{
  "name": "#1000",
  "description": "...",
  "image": "ipfs://<image_CID>/file.png",
  "external_url": "https://...",
  "attributes": [{ "trait_type": "Background", "value": "Pastel Blue" }]
}
```

This JSON is uploaded to Pinata, and the resulting `ipfs://<CID>` URI is passed as the `tokenURI` argument to `createToken`.

---

## Result

**Already deployed smart-contracts and IPFS file**

- IPFS file: https://ipfs.io/ipfs/QmXdCGS6QTDRK9z3Viy1QghQ6HVBF2kxgjZwerd6S9DoTA
- Sepolia contract: https://sepolia.etherscan.io/address/0x91Ad59445B85a1839f47f9D60Df2d4d2816837F8#code
- BASE contract: https://basescan.org/address/0x91Ad59445B85a1839f47f9D60Df2d4d2816837F8#code

---

## Troubleshooting

**`BAD_DATA value="0x"` when calling the contract right after a deploy.** A public load-balanced RPC served the read from a node that had not yet seen the deployment. The 3-stage workflow makes this unlikely (there is always a manual gap between `deploy:*` and `mint:*`), but if you still hit it, wait a few seconds and re-run, or switch to a private RPC (Alchemy / Infura) in `.env.<env>`.

**`Etherscan V1 deprecated` warning during verify.** Make sure `hardhat.config.ts` has `etherscan: { apiKey: ETHERSCAN_API_KEY }` (a single string), not the per-network object form. The key must be from etherscan.io, not basescan.org.

**`Pinata responded 401`.** The JWT in `.env.<env>` is missing, expired, or has insufficient scopes. Re-issue it at https://app.pinata.cloud/developers/api-keys with `pinFileToIPFS` and `pinJSONToIPFS` permissions.

**`require(msg.value == listPrice)` reverts on mint.** Send exactly `0.01 ETH` along with `createToken`. The mint scripts in this repo read `listPrice` directly from the contract and forward it, so this should never happen unless you craft the tx manually.
