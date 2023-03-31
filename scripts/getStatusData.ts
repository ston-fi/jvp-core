import { Address, toNano, Dictionary } from 'ton-core';

import { RegisterContract, RegisterConfig, registerOpCodes } from '../wrappers/Register';
import { VoteStatusContract, VoteStatusConfig, voteStatusOpCodes } from '../wrappers/VoteStatus';
import { VoteStorageContract, VoteStorageConfig, voteStorageOpCodes } from '../wrappers/VoteStorage';

import { compile, NetworkProvider } from '@ton-community/blueprint';
import * as color from "../helpers/color";
import { getSeqNo, readConfig, updateConfig, waitSeqNoChange } from '../helpers/helpers';

export async function run(provider: NetworkProvider) {
    let config = readConfig()
    if (config.voteStatusAddress === null) {
        throw new Error('voteStatusAddress is not defined')
    }

    const senderAddress = provider.sender().address as Address
    
    const status  = provider.open(VoteStatusContract.createFromAddress(config.voteStatusAddress));

    let data = await status.getVoteStatusData()

    console.log(data);
    
}
