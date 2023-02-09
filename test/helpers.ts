import BN from "bn.js";

import {
    Address,
    Cell,
    toNano,
    contractAddress,
    TonClient,
    beginDict,
    beginCell,
    parseDict
} from "ton";

import * as helper from "../contracts/helpers";
import * as register from "../contracts/register";
import * as voteStatus from "../contracts/vote_status";
import * as voteStorage from "../contracts/vote_storage";
import * as color from "./color";

import Prando from "prando";
import { SendMessageResult } from "@ton-community/tx-emulator";
import { SmartContract } from "@ton-community/tx-emulator";
import * as fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export type Dict = Cell | null;

export const zeroAddress = new Address(0, Buffer.alloc(32, 0));

export const opCodeList = {
    cast_vote: new BN(0x13828ee9),
    verify_vote: new BN(0x5e73911f),
    add_vote: new BN(0x54e85894),
    add_user: new BN(0x836b0bb9),
    remove_user: new BN(0x9ff56bb9),
    change_admin: new BN(0xd4deb03b),
    claim_admin: new BN(0xb443e630),
    reset_gas: new BN(0x42a0fb43),
    reset_gas_storage: new BN(0xda764ba3),
} as const;

export function parseAddressFromCell(cell: Cell) {
    return cell.beginParse().readAddress();
}

export function reverseBN(bn: BN) {
    return bn.toNumber() ? new BN(0) : new BN(1);
}

export function wrongOpCode(): Cell {
    return helper.beginMessage({ op: new BN(0xffffffff) })
        .endCell();
}

export function randomAddress(seed: string, workchain?: number) {
    const random = new Prando(seed);
    const hash = Buffer.alloc(32);
    for (let i = 0; i < hash.length; i++) {
        hash[i] = random.nextInt(0, 255);
    }
    return new Address(workchain ?? 0, hash);
}

export function isBounced(ctx: SendMessageResult) {
    if (ctx.transaction.outMessages[0].info.type == 'internal')
        return ctx.transaction.outMessages[0].info.bounced;
    else
        throw ("No transaction found");
}


export function getRegisterInitData(addressList: Dict, admin?: Address) {
    return {
        adminAddress: admin ?? helper.getMyAddress(),
        addressList: addressList,
        voteStorageCode: Cell.fromBoc(fs.readFileSync("build/vote_storage.cell"))[0],
        voteStatusCode: Cell.fromBoc(fs.readFileSync("build/vote_status.cell"))[0],
    };
};

export function getRegisterAddress(addressList: Dict, admin?: Address) {
    return contractAddress({
        workchain: 0,
        initialCode: Cell.fromBoc(fs.readFileSync("build/register.cell"))[0],
        initialData: register.data(getRegisterInitData(addressList, admin))
    });
};

export function getRegister(addressList: Dict, admin?: Address) {
    return SmartContract.fromState({
        address: getRegisterAddress(addressList, admin),
        accountState: {
            type: 'active',
            code: Cell.fromBoc(fs.readFileSync("build/register.cell"))[0],
            data: register.data(getRegisterInitData(addressList, admin))
        },
        balance: toNano(10)
    });
};

export function getVoteStorageInitData(addressList: Dict, jettonAddress: Address, admin?: Address) {
    return {
        registerAddress: getRegisterAddress(addressList, admin),
        jettonAddress: jettonAddress,
        whiteVotes: new BN(0),
        blackVotes: new BN(0),
        voteStatusCode: Cell.fromBoc(fs.readFileSync("build/vote_status.cell"))[0],
    };
};

export function getVoteStorageAddress(addressList: Dict, jettonAddress: Address, admin?: Address) {
    return contractAddress({
        workchain: 0,
        initialCode: Cell.fromBoc(fs.readFileSync("build/vote_storage.cell"))[0],
        initialData: voteStorage.data(getVoteStorageInitData(addressList, jettonAddress, admin))
    });
};

export function getVoteStorage(addressList: Dict, jettonAddress: Address, admin?: Address) {
    return SmartContract.fromState({
        address: getVoteStorageAddress(addressList, jettonAddress, admin),
        accountState: {
            type: 'active',
            code: Cell.fromBoc(fs.readFileSync("build/vote_storage.cell"))[0],
            data: voteStorage.data(getVoteStorageInitData(addressList, jettonAddress, admin))
        },
        balance: toNano(10)
    });
};

export function getVoteStatusInitData(addressList: Dict, jettonAddress: Address, userAddress: Address, admin?: Address) {
    return {
        jettonAddress: jettonAddress,
        userAddress: userAddress,
        voteStorageAddress: getVoteStorageAddress(addressList, jettonAddress, admin),
        whiteVote: new BN(0),
        blackVote: new BN(0),
    };
};

export function getVoteStatusAddress(addressList: Dict, jettonAddress: Address, userAddress: Address, admin?: Address) {
    return contractAddress({
        workchain: 0,
        initialCode: Cell.fromBoc(fs.readFileSync("build/vote_status.cell"))[0],
        initialData: voteStatus.data(getVoteStatusInitData(addressList, jettonAddress, userAddress, admin))
    });
};

export function getVoteStatus(addressList: Dict, jettonAddress: Address, userAddress: Address, admin?: Address) {
    return SmartContract.fromState({
        address: getVoteStatusAddress(addressList, jettonAddress, userAddress, admin),
        accountState: {
            type: 'active',
            code: Cell.fromBoc(fs.readFileSync("build/vote_status.cell"))[0],
            data: voteStatus.data(getVoteStatusInitData(addressList, jettonAddress, userAddress, admin))
        },
        balance: toNano(10)
    });
};

export function getClient(skipClaimerCheck?: boolean) {
    if (typeof process.env.API_KEY === "undefined") {
        throw new Error("please define API key");
    }

    if (typeof process.env.DEPLOYER_MNEMONIC === "undefined") {
        throw new Error("please define deployer wallet mnemonic");
    }


    if ((typeof process.env.CLAIMER_MNEMONIC === "undefined") && 
        !(skipClaimerCheck)) {
        throw new Error("please define claimer wallet mnemonic");
    }

    let endpointUrl
    if (process.env.TESTNET || process.env.npm_lifecycle_event == "deploy:testnet") {
        color.log(`\n*<y> We are working with <b>'testnet' (https://t.me/testgiver_ton_bot will give you testnet TON)`);
        endpointUrl = "https://testnet.toncenter.com/api/v2/jsonRPC";
    } else {
        color.log(`\n*<y> We are working with <b>'mainnet'`);
        endpointUrl = "https://mainnet.tonhubapi.com/jsonRPC";
    }

    return new TonClient({ endpoint: endpointUrl, apiKey: process.env.API_KEY });
}

export function getAddressDict(addressList: Address[]): Cell {
    const addressListBuilder = beginDict(256);
    for (let user of addressList) {
        addressListBuilder.storeCell(new BN(user.hash, "hex"), beginCell().endCell());
    }
    return addressListBuilder.endDict() as Cell;
};
