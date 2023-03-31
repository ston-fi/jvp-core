# Jetton voting platform

[![TON](https://img.shields.io/badge/based%20on-TON-blue)](https://ton.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/licenses/MIT)

Core contracts for the a jetton voting platform. In-depth architecture doc can be found [here](doc/architecture.md).

## Installation

The following assumes the use of `node@>=18`

```shell
yarn install
```

## Compile contracts

```shell
yarn blueprint build --all
```

## Run tests
  
```shell
yarn test
``` 

## Live blockchain

The user must create an `.env` file from `.env.example` and `deploy.config.json` file from `deploy.config.example.json`

### Deploy

```shell
yarn blueprint run --mainnet --mnemonic deployRegister
```

## Add yourself to voter list

Add your wallet address to the list of voters

```shell
yarn blueprint run --mainnet --mnemonic addMyself
```

### Send vote

Send positive votes:

```shell
yarn blueprint run --mainnet --mnemonic castPosVotes
```

Send negative votes:

```shell
yarn blueprint run --mainnet --mnemonic castPNegVotes
```

### Get methods

Call get method to data on register:

```shell
yarn blueprint run --mainnet --mnemonic getRegisterData
```

Call get method to check data on vote storage:

```shell
yarn blueprint run --mainnet --mnemonic getStorageData
```

Call get method to check data on vote status:

```shell
yarn blueprint run --mainnet --mnemonic getStatusData
```

## Licensing

MIT