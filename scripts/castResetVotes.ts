import { Address, toNano, Dictionary } from 'ton-core';

import { RegisterContract, RegisterConfig, registerOpCodes } from '../wrappers/Register';
import { VoteStatusContract, VoteStatusConfig, voteStatusOpCodes } from '../wrappers/VoteStatus';
import { VoteStorageContract, VoteStorageConfig, voteStorageOpCodes } from '../wrappers/VoteStorage';

import { compile, NetworkProvider } from '@ton-community/blueprint';
import * as color from "../helpers/color";
import { getSeqNo, readConfig, updateConfig, waitSeqNoChange } from '../helpers/helpers';

export async function run(provider: NetworkProvider) {
    let config = readConfig()
    if (config.registerAddress === null) {
        throw new Error('registerAddress is not defined')
    }
    if (config.castResetVotes === null) {
        throw new Error('castResetVotes is not defined')
    }

    const senderAddress = provider.sender().address as Address
    
    const register  = provider.open(RegisterContract.createFromAddress(config.registerAddress));

    let cnt = 1
    for (let voteAddress of config.castResetVotes) {
        color.log(` - <y>Resetting a vote for (${cnt}/${config.castResetVotes.length}): <b>${voteAddress}`)
        const seqno = await getSeqNo(provider, senderAddress)
        await register.sendCastVote(provider.sender(), {
            value: toNano(1),
            voteAddress: voteAddress,
            posVote: 0,
            negVote: 0
        })
        await waitSeqNoChange(provider, senderAddress, seqno)
        cnt++

        let vStorageAddress = await register.getVoteStorageAddress(voteAddress)
        let voteStorage = provider.open(VoteStorageContract.createFromAddress(vStorageAddress));
        let successFlag = false
        try {
            let vStatusAddress = await voteStorage.getVoteStatusAddress(senderAddress)
            let voteStatus = provider.open(VoteStatusContract.createFromAddress(vStatusAddress));
            let data = await voteStatus.getVoteStatusData()
            if ((data.positiveVote === 0) && (data.negativeVote === 0)) {
                successFlag = true
            }
        } catch {
            break
        }

        if (!successFlag) {
            color.log(` - <r>Failed to cast vote, abort further operations`)
            break
        } else {
            color.log(` - <g>Vote confirmed`)
        }
    }

    updateConfig(config)
}
