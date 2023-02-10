import BN from "bn.js";
import { Cell, beginCell, Address } from "ton";
import { beginMessage } from "./helpers";

export function data(params: {
    registerAddress: Address;
    voteAddress: Address;
    posVotes: BN;
    negVotes: BN;
    voteStatusCode: Cell;
}): Cell {
    return beginCell()
        .storeAddress(params.registerAddress)
        .storeAddress(params.voteAddress)
        .storeUint(params.posVotes, 64)
        .storeUint(params.negVotes, 64)
        .storeRef(params.voteStatusCode)
        .endCell();
}

export function castVote(params: {
    voterAddress: Address;
    posVotes: BN;
    negVotes: BN;
}): Cell {
    return beginMessage({ op: new BN(0x13828ee9) })
        .storeAddress(params.voterAddress)
        .storeUint(params.posVotes, 1)
        .storeUint(params.negVotes, 1)
        .endCell();
}

export function addVote(params: {
    voterAddress: Address;
    posAdd: BN;
    negAdd: BN;
}): Cell {
    return beginMessage({ op: new BN(0x54e85894) })
        .storeAddress(params.voterAddress)
        .storeInt(params.posAdd, 2)
        .storeInt(params.negAdd, 2)
        .endCell();
}

export function resetGas( params: {
    adminAddress: Address
}): Cell {
    return beginMessage({ op: new BN(0x42a0fb43) })
        .storeAddress(params.adminAddress)
        .endCell();
}