# Jetton voting platform

[![TON](https://img.shields.io/badge/based%20on-TON-blue)](https://ton.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/licenses/MIT)

Core contracts for the a jetton voting platform. In-depth architecture doc can be found [here](doc/architecture.md).

## Installation

The following assumes the use of `node@>=16`

```
yarn install
```

## Compile contracts

```
yarn run build
```

## Run local tests

Tests are in the `test/` folder:

- isolated register contract tests: `1-register.spec.ts`
- isolated vote storage contract tests: `2-vote_storage.spec.ts`
- isolated vote status contract tests: `3-vote_status.spec.ts`
- full message chain tests: `4-system.spec.ts`
  
```
yarn run test
``` 


## Run on-chain tests

The user must create an `.env` file from `.env.example` (`DEPLOYER` and `CLAIMER` wallets must be set; if testing on `mainnet` comment out `TESTNET` var)

Tests are in the `test/` folder:

- on-chain tests of core functions: `1-register.chain.ts`


```
yarn run testchain
```

## Live blockchain

The user must create an `.env` file from `.env.example` (`DEPLOYER` wallet must be set; if testing on `mainnet` comment out `TESTNET` var)

### Deploy

```
yarn run deploy
```

## Add yourself to voter list

Add your wallet address to the list of voters

```
yarn run ts-node ./messages/add_user.ts
```

### Send vote

Send whitelisting votes:

```
yarn run ts-node ./messages/send_msg.ts
```

### Check vote storage

Call get method to check votes on storage:

```
yarn run ts-node ./messages/get_votes.ts
```

## Licensing

MIT