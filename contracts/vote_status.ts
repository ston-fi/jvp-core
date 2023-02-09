import BN from "bn.js";
import { Cell, beginCell, Address } from "ton";
import { beginMessage } from "./helpers";

export function data(params: {
    jettonAddress: Address;
    userAddress: Address;
    voteStorageAddress: Address;
    whiteVote: BN;
    blackVote: BN;
}): Cell {
    return beginCell()
        .storeAddress(params.jettonAddress)
        .storeAddress(params.userAddress)
        .storeAddress(params.voteStorageAddress)
        .storeUint(params.whiteVote, 1)
        .storeUint(params.blackVote, 1)
        .endCell();
}

export function verifyVote(params: {
    whiteVote: BN;
    blackVote: BN;
}): Cell {
    return beginMessage({ op: new BN(0x5e73911f) })
        .storeUint(params.whiteVote, 1)
        .storeUint(params.blackVote, 1)
        .endCell();
}

export function resetGas(): Cell {
    return beginMessage({ op: new BN(0x42a0fb43) })
        .endCell();
}