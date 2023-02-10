import BN from "bn.js";
import { Cell, beginCell, Address } from "ton";
import { beginMessage } from "./helpers";

export function data(params: {
    voteAddress: Address;
    voterAddress: Address;
    voteStorageAddress: Address;
    posVote: BN;
    negVote: BN;
}): Cell {
    return beginCell()
        .storeAddress(params.voteAddress)
        .storeAddress(params.voterAddress)
        .storeAddress(params.voteStorageAddress)
        .storeUint(params.posVote, 1)
        .storeUint(params.negVote, 1)
        .endCell();
}

export function verifyVote(params: {
    posVote: BN;
    negVote: BN;
}): Cell {
    return beginMessage({ op: new BN(0x5e73911f) })
        .storeUint(params.posVote, 1)
        .storeUint(params.negVote, 1)
        .endCell();
}

export function resetGas(): Cell {
    return beginMessage({ op: new BN(0x42a0fb43) })
        .endCell();
}