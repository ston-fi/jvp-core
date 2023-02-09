import * as helpers from "../test/helpers";
import { getMyAddress, parseRawCell } from "../contracts/helpers";

import fs from "fs";
import {
    Address,
    beginDict,
    beginCell,
    TonClient,
    WalletContract,
    WalletV3R2Source,
    Cell,
    parseDict
} from "ton";

import BN from "bn.js";
import dotenv from "dotenv";
import { mnemonicToWalletKey } from "ton-crypto";
dotenv.config();

const JETTON_ADDRESS = Address.parseFriendly("EQCKt2WPGX-fh0cIAz38Ljd_OKQjoZE_cqk7QrYGsNP6wUh-").address;

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


    let endpointUrl: string;
    if (process.env.TESTNET || process.env.npm_lifecycle_event == "deploy:testnet") {
        console.log(`\n* We are working with 'testnet' (https://t.me/testgiver_ton_bot will give you testnet TON)`);
        endpointUrl = "https://testnet.toncenter.com/api/v2/jsonRPC";
    } else if (process.env.SANDBOX || process.env.npm_lifecycle_event == "deploy:sandbox") {
        console.log(`\n* We are working with 'testnet' (https://t.me/sandbox_faucet_bot will give you sandbox TON)`);
        endpointUrl = "https://sandbox.tonhubapi.com/jsonRPC";
    } else {
        console.log(`\n* We are working with 'mainnet'`);
        endpointUrl = "https://mainnet.tonhubapi.com/jsonRPC";
    }

    // initialize globals
    const client = new TonClient({ endpoint: endpointUrl, apiKey: process.env.API_KEY });
    const workchain = 0;

    const deployerMnemonic = process.env.DEPLOYER_MNEMONIC as string;

    const walletKey = await mnemonicToWalletKey(deployerMnemonic.split(" "));
    const walletContract = WalletContract.create(client, WalletV3R2Source.create({ publicKey: walletKey.publicKey, workchain }));
    console.log(walletContract.address.toFriendly());

    let addrRegister = helpers.getRegisterAddress(addressList);
    let addrStorage = helpers.getVoteStorageAddress(addressList, JETTON_ADDRESS);
    let addrStatus = helpers.getVoteStatusAddress(addressList, JETTON_ADDRESS, myAddress);

    console.log(`Register: ${addrRegister.toFriendly()}`);
    console.log(`Storage: ${addrStorage.toFriendly()}`);
    console.log(`Status: ${addrStatus.toFriendly()}`);

    let getData = await client.callGetMethod(addrRegister, "get_register_data", []);

    // console.log(getData.stack);
    
    const addrAdmin = parseRawCell(getData.stack[0]).beginParse().readAddress()
    const addrListCell = parseRawCell(getData.stack[2])

    const addrMap = parseDict(addrListCell.beginParse(), 256, (slice) => {
        return null;
    });
    const keyList = [...addrMap.keys()];

    console.log(addrAdmin)
    console.log(keyList)

}


main();