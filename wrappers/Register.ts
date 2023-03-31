
import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    Dictionary
} from 'ton-core';

import { parseDict } from "ton-core/dist/dict/parseDict";
import { beginMessage, emptyCell, padRawHexAddress, rawNumberToAddress } from '../helpers/helpers';


export type RegisterConfig = {
    adminAddress: Address,
    adminPendingAddress: Address | null,
    addressDict: Dictionary<bigint, Cell>,
    voteStorageCode: Cell,
    voteStatusCode: Cell;
};

export function registerConfigToCell(config: RegisterConfig): Cell {
    return beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.adminPendingAddress)
        .storeDict(config.addressDict)
        .storeRef(config.voteStorageCode)
        .storeRef(config.voteStatusCode)
        .endCell();
}

export const registerOpCodes = {
    castVote: 0x13828ee9,
    addVoter: 0x9b3f4098,
    removeVoter: 0x9b23def8,
    changeAdmin: 0xd4deb03b,
    claimAdmin: 0xb443e630,
    resetGas: 0x42a0fb43,
    resetGasStorage: 0xda764ba3,
} as const;

export class RegisterContract implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) { }

    static createFromAddress(address: Address) {
        return new RegisterContract(address);
    }

    static createFromConfig(config: RegisterConfig, code: Cell, workchain = 0) {
        const data = registerConfigToCell(config);
        const init = { code, data };
        return new RegisterContract(contractAddress(workchain, init), init);
    }

    async sendEmpty(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: emptyCell(),
        });
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: emptyCell(),
        });
    }

    async sendCastVote(provider: ContractProvider, via: Sender, opts: {
        value: bigint,
        voteAddress: Address,
        posVote: 0 | 1,
        negVote: 0 | 1;
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(registerOpCodes.castVote)
                .storeAddress(opts.voteAddress)
                .storeUint(opts.posVote, 1)
                .storeUint(opts.negVote, 1)
                .endCell()
        });
    }

    async sendAddVoter(provider: ContractProvider, via: Sender, opts: {
        value: bigint,
        voterAddress: Address,
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(registerOpCodes.addVoter)
                .storeAddress(opts.voterAddress)
                .endCell()
        });
    }

    async sendRemoveVoter(provider: ContractProvider, via: Sender, opts: {
        value: bigint,
        voterAddress: Address,
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(registerOpCodes.removeVoter)
                .storeAddress(opts.voterAddress)
                .endCell()
        });
    }

    async sendChangeAdmin(provider: ContractProvider, via: Sender, opts: {
        value: bigint,
        newAdminAddress: Address,
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(registerOpCodes.changeAdmin)
                .storeAddress(opts.newAdminAddress)
                .endCell()
        });
    }

    async sendResetGasStorage(provider: ContractProvider, via: Sender, opts: {
        value: bigint,
        voteAddress: Address,
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(registerOpCodes.resetGasStorage)
                .storeAddress(opts.voteAddress)
                .endCell()
        });
    }

    async sendClaimAdmin(provider: ContractProvider, via: Sender, value: bigint,) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(registerOpCodes.claimAdmin)
                .endCell()
        });
    }

    async sendResetGas(provider: ContractProvider, via: Sender, value: bigint,) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(registerOpCodes.resetGas)
                .endCell()
        });
    }

    async getRegisterData(provider: ContractProvider) {
        const result = await provider.get('get_register_data', []);
        const resData = {
            adminAddress: result.stack.readAddress(),
            adminPendingAddress: result.stack.readAddressOpt(),
            addressListCell: result.stack.readCellOpt(),
            voteStorageCode: result.stack.readCell(),
            voteStatusCode: result.stack.readCell(),
        }
        const addressList: Address[] = []

        if (resData.addressListCell !== null) {
            const addrMap = parseDict(resData.addressListCell.beginParse(), 256, (slice) => {
                return null;
            });
            for (let k of addrMap.keys()) {
                addressList.push(rawNumberToAddress(k))
            }
        }

        return {
            adminAddress: resData.adminAddress,
            adminPendingAddress: resData.adminPendingAddress,
            addressList: addressList,
            voteStorageCode: resData.voteStorageCode,
            voteStatusCode: resData.voteStatusCode,
        }
    }

    async getVoteStorageAddress(provider: ContractProvider, voteAddress: Address) {
        const result = await provider.get('get_vote_storage_address', [{
            type: 'slice',
            cell: beginCell().storeAddress(voteAddress).endCell()
        }]);
        return result.stack.readAddress();
    }
}