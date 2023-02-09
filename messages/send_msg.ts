import * as register from "../contracts/register";
import * as helpers from "../test/helpers";
import { getMyAddress } from "../contracts/helpers";

import fs from "fs";
import {
    Address,
    beginDict,
    beginCell,
    toNano,
    TonClient,
    WalletContract,
    WalletV3R2Source,
    SendMode,
    CellMessage,
    CommonMessageInfo,
    InternalMessage
} from "ton";

import BN from "bn.js";
import dotenv from "dotenv";
import { mnemonicToWalletKey } from "ton-crypto";
dotenv.config();

const JETTON_ADDRESS = Address.parseFriendly("EQCKt2WPGX-fh0cIAz38Ljd_OKQjoZE_cqk7QrYGsNP6wUh-").address;

const DEPLOY_GUARD = 0;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const myAddress = getMyAddress();
    const addressListBuilder = beginDict(256);
    // addressListBuilder.storeCell(new BN(myAddress.hash, "hex"), beginCell().endCell());
    try {
        const rndAddress = Address.parseFriendly(fs.readFileSync("build/_rnd_addr.txt").toString()).address;
        addressListBuilder.storeCell(new BN(rndAddress.hash, "hex"), beginCell().endCell());
    } catch {

    }
    const addressList = addressListBuilder.endDict();

    const registerAddress = helpers.getRegisterAddress(addressList);

    let endpointUrl: string;
    if (process.env.TESTNET || process.env.npm_lifecycle_event == "deploy:testnet") {
        console.log(`\n* We are working with 'testnet' (https://t.me/testgiver_ton_bot will give you testnet TON)`);
        endpointUrl = "https://testnet.toncenter.com/api/v2/jsonRPC";
    } else {
        console.log(`\n* We are working with 'mainnet'`);
        endpointUrl = "https://mainnet.tonhubapi.com/jsonRPC";
    }

    // initialize globals
    const client = new TonClient({ endpoint: endpointUrl, apiKey: process.env.API_KEY });
    const gas = toNano(1); // this will be (almost in full) the balance of a new deployed contract and allow it to pay rent
    const workchain = 0;

    const deployerMnemonic = process.env.DEPLOYER_MNEMONIC as string;

    const walletKey = await mnemonicToWalletKey(deployerMnemonic.split(" "));
    const walletContract = WalletContract.create(client, WalletV3R2Source.create({ publicKey: walletKey.publicKey, workchain }));
    console.log(walletContract.address.toFriendly());

    if (!DEPLOY_GUARD) {
        console.log(` - Let's send msg to the contract on-chain..`);

        const seqno = await walletContract.getSeqNo();
        await sleep(2000);

        const transfer = walletContract.createTransfer({
            secretKey: walletKey.secretKey,
            seqno: seqno,
            sendMode: SendMode.PAY_GAS_SEPARATLY + SendMode.IGNORE_ERRORS,
            order: new InternalMessage({
                to: registerAddress,
                value: gas,
                bounce: true,
                body: new CommonMessageInfo({
                    body: new CellMessage(register.castVote({
                        jettonAddress: JETTON_ADDRESS,
                        whiteVote: new BN(1),
                        blackVote: new BN(0)
                    })),
                }),
            }),
        });

        await client.sendExternalMessage(walletContract, transfer);
        await sleep(1000);
        let successFlag = 0;
        for (let attempt = 0; attempt < 30; attempt++) {
            await sleep(2500);
            const seqnoAfter = await walletContract.getSeqNo();
            if (seqnoAfter > seqno) {
                successFlag = 1;
                break;
            };
        }
        if (successFlag) {
            console.log(` - Sent transaction done successfully`);
        } else {
            console.log(` - Sent transaction didn't go through`);
        }
    }

    console.log(`Register: ${helpers.getRegisterAddress(addressList).toFriendly()}\n`);
    console.log(`Storage: ${helpers.getVoteStorageAddress(addressList, JETTON_ADDRESS).toFriendly()}\n`);
    console.log(`Status: ${helpers.getVoteStatusAddress(addressList, JETTON_ADDRESS, myAddress).toFriendly()}\n`);
}


main();