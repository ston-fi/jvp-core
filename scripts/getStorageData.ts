import { Address, toNano, Dictionary } from 'ton-core';

import { RegisterContract, RegisterConfig, registerOpCodes } from '../wrappers/Register';
import { VoteStatusContract, VoteStatusConfig, voteStatusOpCodes } from '../wrappers/VoteStatus';
import { VoteStorageContract, VoteStorageConfig, voteStorageOpCodes } from '../wrappers/VoteStorage';

import { compile, NetworkProvider } from '@ton-community/blueprint';
import * as color from "../helpers/color";
import { getSeqNo, readConfig, updateConfig, waitSeqNoChange } from '../helpers/helpers';

export async function run(provider: NetworkProvider) {
    let config = readConfig()
    if (config.voteStorageAddress === null) {
        throw new Error('voteStorageAddress is not defined')
    }

    const senderAddress = provider.sender().address as Address
    
    const storage  = provider.open(VoteStorageContract.createFromAddress(config.voteStorageAddress));

    let data = await storage.getVoteStorageData()

    console.log(data);
    
}
