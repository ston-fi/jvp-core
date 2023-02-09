import BN from "bn.js";
import { Cell, beginCell, Address } from "ton";
import { beginMessage } from "./helpers";

export function data(params: {
    registerAddress: Address;
    jettonAddress: Address;
    whiteVotes: BN;
    blackVotes: BN;
    voteStatusCode: Cell;
}): Cell {
    return beginCell()
        .storeAddress(params.registerAddress)
        .storeAddress(params.jettonAddress)
        .storeUint(params.whiteVotes, 64)
        .storeUint(params.blackVotes, 64)
        .storeRef(params.voteStatusCode)
        .endCell();
}

export function castVote(params: {
    userAddress: Address;
    whiteVote: BN;
    blackVote: BN;
}): Cell {
    return beginMessage({ op: new BN(0x13828ee9) })
        .storeAddress(params.userAddress)
        .storeUint(params.whiteVote, 1)
        .storeUint(params.blackVote, 1)
        .endCell();
}

export function addVote(params: {
    userAddress: Address;
    whiteAdd: BN;
    blackAdd: BN;
}): Cell {
    return beginMessage({ op: new BN(0x54e85894) })
        .storeAddress(params.userAddress)
        .storeInt(params.whiteAdd, 2)
        .storeInt(params.blackAdd, 2)
        .endCell();
}

export function resetGas( params: {
    adminAddress: Address
}): Cell {
    return beginMessage({ op: new BN(0x42a0fb43) })
        .storeAddress(params.adminAddress)
        .endCell();
}