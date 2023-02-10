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
    voteAddress: Address;
    posVote: BN;
    negVote: BN;
}): Cell {
    return beginMessage({ op: new BN(0x13828ee9) })
        .storeAddress(params.voteAddress)
        .storeUint(params.posVote, 1)
        .storeUint(params.negVote, 1)
        .endCell();
}

export function addVoter(params: {
    voterAddress: Address;
}): Cell {
    return beginMessage({ op: new BN(0x9b3f4098) })
        .storeAddress(params.voterAddress)
        .endCell();
}

export function removeVoter(params: {
    voterAddress: Address;
}): Cell {
    return beginMessage({ op: new BN(0x9b23def8) })
        .storeAddress(params.voterAddress)
        .endCell();
}

export function changeAdmin(params: {
    newAdminAddress: Address;
}): Cell {
    return beginMessage({ op: new BN(0xd4deb03b) })
        .storeAddress(params.newAdminAddress)
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
    voteAddress: Address
}): Cell {
    return beginMessage({ op: new BN(0xda764ba3) })
        .storeAddress(params.voteAddress)
        .endCell();
}

