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
    if (config.removeVoterList === null) {
        throw new Error('removeVoterList is not defined')
    }

    const senderAddress = provider.sender().address as Address
    
    const register  = provider.open(RegisterContract.createFromAddress(config.registerAddress));
    
    let cnt = 1
    for (let user of config.removeVoterList) {
        color.log(` - <y>Removing address from voters list (${cnt}/${config.removeVoterList.length}): <b>${user}`)
        const seqno = await getSeqNo(provider, senderAddress)
        await register.sendRemoveVoter(provider.sender(), {
            value: toNano(1),
            voterAddress: user
        })
        await waitSeqNoChange(provider, senderAddress, seqno)
        cnt++
    }

    updateConfig(config)
}
