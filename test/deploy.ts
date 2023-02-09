import axios from "axios";
import axiosThrottle from "axios-request-throttle";
import fs from "fs";
import path from "path";
import glob from "fast-glob";
import { Address, Cell, CellMessage, CommonMessageInfo, fromNano, InternalMessage, StateInit, toNano } from "ton";
import { TonClient, WalletContract, contractAddress, SendMode } from "ton";
import { KeyPair } from "ton-crypto";
import dotenv from "dotenv";
import BN from "bn.js";
import * as color from "./color";

axiosThrottle.use(axios, { requestsPerSecond: 0.5 });
dotenv.config();

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deploy(params: {
    contractFileName: string,
    addressList: Cell,
    workchain: number,
    client: TonClient,
    walletKey: KeyPair,
    walletContract: WalletContract,
    newContractFunding: BN,
}): Promise<Address | null> {

    // open the wallet and make sure it has enough TON

    const walletBalance = await params.client.getBalance(params.walletContract.address);
    await sleep(3 * 1000);
    if (walletBalance.lt(toNano(0.2))) {
        throw new Error(` - ERROR: Wallet has less than 0.2 TON for gas (${fromNano(walletBalance)} TON), please send some TON for gas first`);
    }

    const rootContract = glob.sync([`build/${params.contractFileName}.deploy.ts`])[0];

    const contractName = path.parse(path.parse(rootContract).name).name;

    const deployInitScript = require(__dirname + "/../" + rootContract);
    if (typeof deployInitScript.initDataTest !== "function") {
        throw new Error(` - ERROR: '${rootContract}' does not have 'initData()' function`);
    }
    const initDataCell = deployInitScript.initDataTest(params.addressList) as Cell;

    if (typeof deployInitScript.initMessage !== "function") {
        throw new Error(` - ERROR: '${rootContract}' does not have 'initMessage()' function`);
    }
    const initMessageCell = deployInitScript.initMessage() as Cell | null;

    const cellArtifact = `build/${contractName}.cell`;
    if (!fs.existsSync(cellArtifact)) {
        throw new Error(` - ERROR: '${cellArtifact}' not found, did you build?`);
    }
    const initCodeCell = Cell.fromBoc(fs.readFileSync(cellArtifact))[0];

    const newContractAddress = contractAddress({ workchain: params.workchain, initialData: initDataCell, initialCode: initCodeCell });
    if (await params.client.isContractDeployed(newContractAddress)) {
        return null
    }
    color.log(` - <y>New contract address is: <b>${newContractAddress.toFriendly()}`);
    await sleep(2000);

    // console.log(` - Let's deploy the contract on-chain..`);
    const seqno = await params.walletContract.getSeqNo();
    await sleep(2000);

    const transfer = params.walletContract.createTransfer({
        secretKey: params.walletKey.secretKey,
        seqno: seqno,
        sendMode: SendMode.PAY_GAS_SEPARATLY + SendMode.IGNORE_ERRORS,
        order: new InternalMessage({
            to: newContractAddress,
            value: params.newContractFunding,
            bounce: false,
            body: new CommonMessageInfo({
                stateInit: new StateInit({ data: initDataCell, code: initCodeCell }),
                body: initMessageCell !== null ? new CellMessage(initMessageCell) : null,
            }),
        }),
    });
    await params.client.sendExternalMessage(params.walletContract, transfer);
    await sleep(1000);
    color.log(` - <y>Deploy transaction sent successfully`);

    color.log(` - <y>Waiting up to 75 seconds to check if the contract was actually deployed..`);
    for (let attempt = 0; attempt < 30; attempt++) {
        await sleep(2500);
        const seqnoAfter = await params.walletContract.getSeqNo();
        if (seqnoAfter > seqno) break;
    }
    await sleep(5 * 1000);
    if (await params.client.isContractDeployed(newContractAddress)) {
        color.log(` - <g>SUCCESS! <y>Contract deployed successfully to address: <b>${newContractAddress.toFriendly()}`);
        await sleep(1000);
    } else {
        console.log(` - <r>FAILURE! <y>Contract address still looks uninitialized: <b>${newContractAddress.toFriendly()}`);
    }
    return newContractAddress
}

