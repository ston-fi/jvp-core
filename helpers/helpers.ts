import { Cell, Builder, beginCell, Address } from "ton-core";
import { NetworkProvider, compile } from '@ton-community/blueprint';
import fs from 'fs';
import * as color from "./color";

export function beginMessage(op: bigint | number): Builder {
    return beginCell()
        .storeUint(op, 32)
        .storeUint(BigInt(Math.floor(Math.random() * Math.pow(2, 31))), 64);
}

export function emptyCell(): Cell {
    return beginCell().endCell();
}

export function stringCell(data: string): Cell {
    return beginCell().storeStringTail(data).endCell()
}

export function codeFromString(code: string): Cell {
    return Cell.fromBoc(Buffer.from(code, 'hex'))[0];
}

export function padRawHexAddress(addressHex: string) {
    return `${'0'.repeat(64)}${addressHex}`.slice(-64)
}

export function rawNumberToAddress(address: string | bigint, workchain = 0) {
    if (typeof address === "string") {
        return Address.parseRaw(`${workchain}:${padRawHexAddress(address)}`)
    } else {
        return Address.parseRaw(`${workchain}:${padRawHexAddress(BigInt(address).toString(16))}`)
    }
}

export function getContractCode(contract: string): Cell {
    let tmp: string
    try {
        tmp = JSON.parse(fs.readFileSync(`build/${contract}.compiled.json`, 'utf-8')).hex as string;
    } catch {
        let msg = color.colorText(`<bld><r>Error: build data for <b>'${contract}' <r>cannot be found, you need to build it first`)
        throw new Error(msg[0])
    }
    return codeFromString(tmp);
}

export async function compileX(contract: string, noSave?: boolean): Promise<Cell> {
    const artifact = await compile(contract);
    if (!noSave) {
        fs.mkdirSync("build", { recursive: true })
        fs.writeFileSync(`build/${contract}.compiled.json`, JSON.stringify({
            hex: artifact.toBoc().toString('hex'),
        }))
    }
    return artifact;
}

export function isBnArray(inp: Array<bigint> | Array<number>): inp is Array<bigint> {
    if (typeof inp[0] === "bigint") {
        return true;
    } else {
        return false;
    }
}


export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSeqNo(provider: NetworkProvider, address: Address) {
    if (await provider.isContractDeployed(address)) {
        let res = await provider.api().runMethod(address, 'seqno');
        return res.stack.readNumber()
    }
    else {
        return 0;
    }
}

export async function waitSeqNoChange(provider: NetworkProvider, target: Address, previousSeqno: number) {
    color.log(` - <y>Waiting up to <b>45 <y>seconds to confirm transaction`);
    let successFlag = 0;
    for (let attempt = 0; attempt < 45; attempt++) {
        await sleep(1000);
        const seqnoAfter = await getSeqNo(provider, target)
        if (seqnoAfter > previousSeqno) {
            successFlag = 1;
            break;
        };
    }
    if (successFlag) {
        color.log(` - <g>Sent transaction done successfully`);
        return true
    } else {
        color.log(` - <r>Sent transaction didn't go through`);
        return false
    }
}

export type ChainConfig = {
    registerAddress: Address | null,
    voteAddress: Address | null,
    voteStorageAddress: Address | null,
    voteStatusAddress: Address | null,
    newAdminAddress: Address | null,
    addVotersList: Address[] | null,
    removeVoterList: Address[] | null,
    castPosVotes: Address[] | null,
    castNegVotes: Address[] | null,
    castResetVotes: Address[] | null,
}

type ChainConfigStr = {
    registerAddress?: string,
    voteAddress?: string,
    voteStorageAddress?: string,
    voteStatusAddress?: string,
    newAdminAddress?: string,
    addVotersList?: string[],
    removeVoterList?: string[],
    castPosVotes?: string[],
    castNegVotes?: string[],
    castResetVotes?: string[],
}

export function parseAddress(inp: string): Address {
    if(inp.startsWith("0:")) {
        return Address.parseRaw(inp)
    } else {
        return Address.parseFriendly(inp).address
    }
}

export function readConfig(path = "build/deploy.config.json"): ChainConfig {
    let data: ChainConfigStr

    const resolveAddress = (inp: string | undefined) => {
        if (typeof inp === "undefined") {
            return null
        } else {
            return Address.parseFriendly(inp).address
        }
    }

    const resolveArray = (inp: string[] | undefined) => {
        let addressList: Address[] = []
        if (typeof inp === "undefined") {
            return null
        } else {
            for (let item of inp) {
                addressList.push(Address.parseFriendly(item).address)
            }
            return addressList ? addressList : null
        }
    }

    const resolveCast = (inp: string | string[] | undefined) => {
        if (typeof inp === "undefined") {
            return null
        } else if (typeof inp === "string") {
            let tokenInfo = JSON.parse(fs.readFileSync(inp, 'utf8'));
            let tokenList: Address[] = []
            for (let item of tokenInfo) {
                tokenList.push(parseAddress(item["address"]))
            } 
            return tokenList
        } else {
            return resolveArray(inp)
        }
    }

    try {
        data = JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch {
        return {
            registerAddress: null,
            voteAddress: null,
            voteStorageAddress: null,
            voteStatusAddress: null,
            newAdminAddress: null,
            addVotersList: null,
            removeVoterList: null,
            castPosVotes: null,
            castNegVotes: null,
            castResetVotes: null,
        }
    }

    return {
        registerAddress: resolveAddress(data.registerAddress),
        voteAddress: resolveAddress(data.voteAddress),
        voteStorageAddress: resolveAddress(data.voteStorageAddress),
        voteStatusAddress: resolveAddress(data.voteStatusAddress),
        newAdminAddress: resolveAddress(data.newAdminAddress),
        addVotersList: resolveArray(data.addVotersList),
        removeVoterList: resolveArray(data.removeVoterList),
        castPosVotes: resolveCast(data.castPosVotes),
        castNegVotes: resolveCast(data.castNegVotes),
        castResetVotes: resolveCast(data.castResetVotes),
    }
}

export function updateConfig(config: ChainConfig, path = "build/deploy.config.json") {
    let strObj: ChainConfigStr = {}
    let item: keyof ChainConfig
    for (item in config) {
        if (config[item] instanceof Array) {
            // @ts-ignore
            strObj[item] = (config[item] as Address[]).map((item) => {return item.toString()})
        } else {
            // @ts-ignore
            strObj[item] = config[item] !== null ? config[item]?.toString() : undefined
        }
    }
    fs.mkdirSync("build", { recursive: true })
    fs.writeFileSync(path, JSON.stringify(strObj, null, 4), "utf-8")
}