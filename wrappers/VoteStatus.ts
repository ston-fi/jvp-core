
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


export type VoteStatusConfig = {
    voteAddress: Address,
    voterAddress: Address,
    voteStorageAddress: Address,
    posVote: 0 | 1,
    negVote: 0 | 1
};

export function voteStatusConfigToCell(config: VoteStatusConfig): Cell {
    return beginCell()
        .storeAddress(config.voteAddress)
        .storeAddress(config.voterAddress)
        .storeAddress(config.voteStorageAddress)
        .storeUint(config.posVote, 1)
        .storeUint(config.negVote, 1)
        .endCell();
}

export const voteStatusOpCodes = {
    verifyVote: 0x5e73911f,
    resetGas: 0x42a0fb43,
} as const

export class VoteStatusContract implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) { }

    static createFromAddress(address: Address) {
        return new VoteStatusContract(address);
    }

    static createFromConfig(config: VoteStatusConfig, code: Cell, workchain = 0) {
        const data = voteStatusConfigToCell(config);
        const init = { code, data };
        return new VoteStatusContract(contractAddress(workchain, init), init);
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
            body: beginMessage(voteStatusOpCodes.resetGas)
                .endCell(),
        });
    }

    async sendVerifyVote(provider: ContractProvider, via: Sender, opts: {
        value: bigint,
        posVote: 0 | 1,
        negVote: 0 | 1
    }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(voteStatusOpCodes.verifyVote)
                .storeUint(opts.posVote, 1)
                .storeUint(opts.negVote, 1)
                .endCell()
        });
    }

    async getVoteStatusData(provider: ContractProvider) {
        const result = await provider.get('get_vote_status_data', []);
        return {
            voteAddress: result.stack.readAddress(),
            voterAddress: result.stack.readAddress(),
            voteStorageAddress: result.stack.readAddress(),
            positiveVote: result.stack.readNumber(),
            negativeVote: result.stack.readNumber(),
        }
    }
}