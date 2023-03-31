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
    if (config.castNegVotes === null) {
        throw new Error('castNegVotes is not defined')
    }

    const senderAddress = provider.sender().address as Address
    
    const register  = provider.open(RegisterContract.createFromAddress(config.registerAddress));

    let cnt = 1
    for (let voteAddress of config.castNegVotes) {
        color.log(` - <y>Casting a positive vote for (${cnt}/${config.castNegVotes.length}): <b>${voteAddress}`)
        const seqno = await getSeqNo(provider, senderAddress)
        await register.sendCastVote(provider.sender(), {
            value: toNano(1),
            voteAddress: voteAddress,
            posVote: 0,
            negVote: 1
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
            if (data.negativeVote === 1) {
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
