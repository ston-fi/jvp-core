import BN from "bn.js";
import { Cell, beginCell, Address } from "ton";
import { beginMessage, getHoleAddress } from "./helpers";

export function data(params: {
    voteStorageCode: Cell;
    voteStatusCode: Cell;
    addressList: Cell | null;
    adminAddress: Address;
}): Cell {
    return beginCell()
        .storeAddress(params.adminAddress)
        .storeAddress(getHoleAddress())
        .storeDict(params.addressList)
        .storeRef(params.voteStorageCode)
        .storeRef(params.voteStatusCode)
        .endCell();
}

export function castVote(params: {
    jettonAddress: Address;
    whiteVote: BN;
    blackVote: BN;
}): Cell {
    return beginMessage({ op: new BN(0x13828ee9) })
        .storeAddress(params.jettonAddress)
        .storeUint(params.whiteVote, 1)
        .storeUint(params.blackVote, 1)
        .endCell();
}

export function addUser(params: {
    userAddress: Address;
}): Cell {
    return beginMessage({ op: new BN(0x836b0bb9) })
        .storeAddress(params.userAddress)
        .endCell();
}

export function removeUser(params: {
    userAddress: Address;
}): Cell {
    return beginMessage({ op: new BN(0x9ff56bb9) })
        .storeAddress(params.userAddress)
        .endCell();
}

export function changeAdmin(params: {
    userAddress: Address;
}): Cell {
    return beginMessage({ op: new BN(0xd4deb03b) })
        .storeAddress(params.userAddress)
        .endCell();
}

export function claimAdmin(): Cell {
    return beginMessage({ op: new BN(0xb443e630) })
        .endCell();
}

export function resetGas(): Cell {
    return beginMessage({ op: new BN(0x42a0fb43) })
        .endCell();
}

export function resetGasStorage( params: {
    jettonAddress: Address
}): Cell {
    return beginMessage({ op: new BN(0xda764ba3) })
        .storeAddress(params.jettonAddress)
        .endCell();
}

