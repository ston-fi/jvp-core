import BN from "bn.js";
import { Builder, beginCell, Address, Cell } from "ton";
import Prando from "prando";
import dotenv from "dotenv";

dotenv.config();

export function beginMessage(params: { op: BN }): Builder {
    return beginCell()
        .storeUint(params.op, 32)
        .storeUint(new BN(Math.floor(Math.random() * Math.pow(2, 31))), 64);
}

export function randomAddress(seed: string, workchain?: number) {
    const random = new Prando(seed);
    const hash = Buffer.alloc(32);
    for (let i = 0; i < hash.length; i++) {
        hash[i] = random.nextInt(0, 255);
    }
    return new Address(workchain ?? 0, hash);
}

export function getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
}

export function getMyAddress() {
    if(typeof process.env.DEPLOYER_ADDRESS === "undefined") {
        throw new Error("define your address in .env")
    }
    return Address.parseFriendly(process.env.DEPLOYER_ADDRESS).address
}

export function getHoleAddress(): Address | null {
    // return Address.parseFriendly("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c").address
    // return beginCell().storeUint(new BN(0), 2).endCell().beginParse().readAddress() as Address
    return null
}

export type RawCell = [
    string,
    {
        bytes: string,
        object: unknown
    }
]

export function parseRawCell(data: RawCell): Cell {
    if (data[0] !== "cell") {
        throw Error("data must be a cell")
    }
    return Cell.fromBoc(Buffer.from(data[1].bytes, 'base64'))[0]
}