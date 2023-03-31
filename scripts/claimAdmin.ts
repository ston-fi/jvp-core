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
    if (config.newAdminAddress === null) {
        throw new Error('newAdminAddress is not defined')
    }

    const senderAddress = provider.sender().address as Address
    if (!config.newAdminAddress.equals(senderAddress)) {
        throw new Error('you are not using newAdminAddress')
    }

    
    const register  = provider.open(RegisterContract.createFromAddress(config.registerAddress));

    color.log(` - <y>Claiming admin status for: ${config.newAdminAddress}`)
    const seqno = await getSeqNo(provider, senderAddress)
    await register.sendClaimAdmin(provider.sender(), toNano(1))
    await waitSeqNoChange(provider, senderAddress, seqno)

    updateConfig(config)
}
