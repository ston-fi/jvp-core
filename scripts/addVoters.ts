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
    if (config.addVotersList === null) {
        throw new Error('addVotersList is not defined')
    }

    const senderAddress = provider.sender().address as Address
    
    const register  = provider.open(RegisterContract.createFromAddress(config.registerAddress));
    
    let cnt = 1
    for (let user of config.addVotersList) {
        color.log(` - <y>Adding address to voters list (${cnt}/${config.addVotersList.length}): <b>${user}`)
        const seqno = await getSeqNo(provider, senderAddress)
        await register.sendAddVoter(provider.sender(), {
            value: toNano(1),
            voterAddress: user
        })
        await waitSeqNoChange(provider, senderAddress, seqno)
        cnt++
    }

    updateConfig(config)
}
