import { Address, toNano, Dictionary } from 'ton-core';

import { RegisterContract, RegisterConfig, registerOpCodes } from '../wrappers/Register';
import { VoteStatusContract, VoteStatusConfig, voteStatusOpCodes } from '../wrappers/VoteStatus';
import { VoteStorageContract, VoteStorageConfig, voteStorageOpCodes } from '../wrappers/VoteStorage';

import { compile, NetworkProvider } from '@ton-community/blueprint';
import * as color from "../helpers/color";
import { readConfig, updateConfig } from '../helpers/helpers';

export async function run(provider: NetworkProvider) {
    let config = readConfig()

    const senderAddress = provider.sender().address as Address
    
    const register = provider.open(RegisterContract.createFromConfig({
        adminAddress: senderAddress,
        adminPendingAddress: null,
        addressDict: Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()),
        voteStorageCode: await compile('VoteStorage'),
        voteStatusCode: await compile('VoteStatus'),
    }, await compile('Register')));

    await register.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(register.address);

    config.registerAddress = register.address
    
    updateConfig(config)
}
