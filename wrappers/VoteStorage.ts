
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


import { beginMessage, emptyCell } from '../helpers/helpers';


export type VoteStorageConfig = {
    registerAddress: Address,
    voteAddress: Address,
    posVotes: bigint | number,
    negVotes: bigint | number,
    voteStatusCode: Cell,
};

export function voteStorageConfigToCell(config: VoteStorageConfig): Cell {
    return beginCell()
        .storeAddress(config.registerAddress)
        .storeAddress(config.voteAddress)
        .storeUint(config.posVotes, 64)
        .storeUint(config.negVotes, 64)
        .storeRef(config.voteStatusCode)
        .endCell();
}

export const voteStorageOpCodes = {
    castVote: 0x13828ee9,
    addVote: 0x54e85894,
    resetGas: 0x42a0fb43,
} as const

export class VoteStorageContract implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) { }

    static createFromAddress(address: Address) {
        return new VoteStorageContract(address);
    }

    static createFromConfig(config: VoteStorageConfig, code: Cell, workchain = 0) {
        const data = voteStorageConfigToCell(config);
        const init = { code, data };
        return new VoteStorageContract(contractAddress(workchain, init), init);
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

    async sendResetGas(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(voteStorageOpCodes.resetGas)
                .endCell(),
        });
    }

    async sendCastVote(provider: ContractProvider, via: Sender, opts: {
        value: bigint,
        voterAddress: Address,
        posVote: 0 | 1,
        negVote: 0 | 1
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(voteStorageOpCodes.castVote)
                .storeAddress(opts.voterAddress)
                .storeUint(opts.posVote, 1)
                .storeUint(opts.negVote, 1)
                .endCell()
        });
    }

    async sendAddVote(provider: ContractProvider, via: Sender, opts: {
        value: bigint,
        voterAddress: Address,
        posAdd: -1 | 0 | 1,
        negAdd: -1 | 0 | 1
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(voteStorageOpCodes.castVote)
                .storeAddress(opts.voterAddress)
                .storeInt(opts.posAdd, 2)
                .storeInt(opts.negAdd, 2)
                .endCell()
        });
    }

    async getVoteStorageData(provider: ContractProvider) {
        const result = await provider.get('get_vote_storage_data', []);
        return {
            registerAddress: result.stack.readAddress(),
            voteAddress: result.stack.readAddress(),
            positiveVotes: result.stack.readNumber(),
            negativeVotes: result.stack.readNumber(),
            voteStatusCode: result.stack.readCell()
        }
    }

    async getVoteStatusAddress(provider: ContractProvider, voterAddress: Address) {
        const result = await provider.get('get_vote_status_address', [{
            type: 'slice',
            cell: beginCell().storeAddress(voterAddress).endCell()
        }]);
        return result.stack.readAddress();
    }
}