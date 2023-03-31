import '@ton-community/test-utils';
import {
    Blockchain,
    TreasuryContract,
    SandboxContract,
    SendMessageResult,
    Event,
    EventMessageSent,
    createShardAccount
} from '@ton-community/sandbox';

import {
    Address,
    Cell,
    Dictionary,
    toNano,
    beginCell,
    Builder,
    Contract,
    Slice
} from 'ton-core';

import {
    expectEqAddress,
    expectNullAddress,
    expectNotBounced,
    expectBounced,
    firstCreatedAddress,
    expectContainsAddress,
    expectNotContainsAddress,
} from "../helpers/test-helpers";

import { compile } from '@ton-community/blueprint';
import * as color from "../helpers/color";

import { RegisterContract, RegisterConfig, registerOpCodes } from '../wrappers/Register';
import { VoteStatusContract, VoteStatusConfig, voteStatusOpCodes } from '../wrappers/VoteStatus';
import { VoteStorageContract, VoteStorageConfig, voteStorageOpCodes } from '../wrappers/VoteStorage';
import { emptyCell } from '../helpers/helpers';


type SBCtrTreasury = SandboxContract<TreasuryContract>;
type SBCtrRegister = SandboxContract<RegisterContract>;
type SBCtrVoteStatus = SandboxContract<VoteStatusContract>;
type SBCtrVoteStorage = SandboxContract<VoteStorageContract>;

type SetupData = {
    register: SBCtrRegister,
    voteStorage: SBCtrVoteStorage
}
type VoteData = {
    register: SBCtrRegister,
    voteStorage: SBCtrVoteStorage,
    voteStatusList: SBCtrVoteStatus[]
}

describe('System tests', () => {
    let blockchain: Blockchain,
        deployer: SBCtrTreasury,
        alice: SBCtrTreasury,
        bob: SBCtrTreasury,
        john: SBCtrTreasury,
        jetton: SBCtrTreasury,
        validUsers: SBCtrTreasury[],
        invalidUsers: SBCtrTreasury[],
        deployRegister: (deployer: SBCtrTreasury) => Promise<SBCtrRegister>,
        basicSetup: (deployer: SBCtrTreasury) => Promise<SetupData>,
        voteSetup: (deployer: SBCtrTreasury, isPositiveVote: boolean[] | boolean) => Promise<VoteData>,
        codeRegister: Cell,
        codeVoteStatus: Cell,
        codeVoteStorage: Cell,
        testCnt: number;

    const getRegisterConfig = (adminAddress: Address): RegisterConfig => {
        return {
            adminAddress: adminAddress,
            adminPendingAddress: null,
            addressDict: Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()),
            voteStorageCode: codeVoteStorage,
            voteStatusCode: codeVoteStatus,
        };
    };


    beforeAll(async () => {
        codeRegister = await compile('Register');
        codeVoteStatus = await compile('VoteStatus');
        codeVoteStorage = await compile('VoteStorage');

        testCnt = 0;
    });

    beforeEach(async () => {
        testCnt++;
        color.log(`<y>Test <b>#${testCnt} <y>processing`);

        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        alice = await blockchain.treasury('alice');
        bob = await blockchain.treasury('bob');
        john = await blockchain.treasury('john');
        jetton = await blockchain.treasury('jetton');

        validUsers = [alice, bob];
        invalidUsers = [john];

        deployRegister = async (deployer: SBCtrTreasury) => {

            const config = getRegisterConfig(deployer.address);

            const register = blockchain.openContract(await RegisterContract.createFromConfig(config, codeRegister));

            const deployResult = await register.sendDeploy(deployer.getSender(), toNano('0.05'));

            expect(deployResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: register.address,
                deploy: true,
            });

            return register;
        };

        basicSetup = async (deployer: SBCtrTreasury) => {
            const register = await deployRegister(deployer)
            const vsAddress = await register.getVoteStorageAddress(jetton.address)


            for(let user of validUsers) {
                let msgResult = await register.sendAddVoter(deployer.getSender(), {
                    value: toNano(1),
                    voterAddress: user.address
                })
                expectNotBounced(msgResult.events)
            }

            return {
                register: register,
                voteStorage: blockchain.openContract(await VoteStorageContract.createFromAddress(vsAddress))
            }
        }

        voteSetup = async (deployer: SBCtrTreasury, isPositiveVote: boolean[] | boolean) => {
            const setup = await basicSetup(deployer)

            let voteStatusList: SBCtrVoteStatus[] = []
            let voteCnt = [0, 0]
            for (let i = 0; i < validUsers.length; i++) {
                let user = validUsers[i]

                let isPosVote: boolean
                if(typeof isPositiveVote === "boolean") {
                    isPosVote = isPositiveVote
                } else {
                    isPosVote = isPositiveVote[i]
                }

                if (isPosVote) {
                    voteCnt[0]++
                } else {
                    voteCnt[1]++
                }

                let msgResult = await setup.register.sendCastVote(user.getSender(), {
                    value: toNano(1),
                    voteAddress: jetton.address,
                    posVote: isPosVote ? 1 : 0,
                    negVote: isPosVote ? 0 : 1,
                })
                expectNotBounced(msgResult.events)

                let voteStatusAddress = await setup.voteStorage.getVoteStatusAddress(user.address)
                let voteStorage = blockchain.openContract(await VoteStatusContract.createFromAddress(voteStatusAddress))
                
                let voteData = await voteStorage.getVoteStatusData()
                expect(voteData.positiveVote).toEqual(isPosVote ? 1 : 0)
                expect(voteData.negativeVote).toEqual(isPosVote ? 0 : 1)

                voteStatusList.push(voteStorage)
            }

            let data = await setup.voteStorage.getVoteStorageData()
            expect(data.positiveVotes).toEqual(voteCnt[0])
            expect(data.negativeVotes).toEqual(voteCnt[1])

            return {
                register: setup.register,
                voteStorage: setup.voteStorage,
                voteStatusList: voteStatusList
            }
        }
    });

    describe("wip", () => {
        
        

        
    });

    describe("Bounces", () => {
        
        it('should bounce if both votes are cast', async () => {
            const setup = await basicSetup(deployer)
            const target = validUsers[0]

            let msgResult = await setup.register.sendCastVote(target.getSender(), {
                value: toNano(1),
                voteAddress: jetton.address,
                posVote: 1,
                negVote: 1,
            })
            expectBounced(msgResult.events)
        });

        it('should bounce vote cast if caller is not voter', async () => {
            const setup = await basicSetup(deployer)
            const target = invalidUsers[0]

            let msgResult = await setup.register.sendCastVote(target.getSender(), {
                value: toNano(1),
                voteAddress: jetton.address,
                posVote: 1,
                negVote: 0,
            })
            expectBounced(msgResult.events)
        });
        
    });

    describe("Register get methods", () => {

        it('should get data', async () => {
            const setup = await basicSetup(deployer)

            let data = await setup.register.getRegisterData()

            expectEqAddress(data.adminAddress, deployer)
            expectNullAddress(data.adminPendingAddress)
            expect(data.addressList.length).toEqual(validUsers.length)

            for (let user of validUsers) {
                expectContainsAddress(data.addressList, user.address)
            }
        });

    });

    describe("VoteStatus get methods", () => {

        it('should get data', async () => {
            const setup = await voteSetup(deployer, true)

            let data = await setup.voteStatusList[0].getVoteStatusData()
            
            expectEqAddress(data.voteAddress, jetton)
            expectEqAddress(data.voteStorageAddress, setup.voteStorage.address)
            expectEqAddress(data.voterAddress, validUsers[0])
            expect(data.positiveVote).toEqual(1)
            expect(data.negativeVote).toEqual(0)
        });

    });

    describe("VoteStatus owner calls", () => {
        it('should reset gas', async () => {
            const setup = await voteSetup(deployer, true)

            let msgResult = await setup.voteStatusList[0].sendResetGas(validUsers[0].getSender(), toNano(1))

            expectNotBounced(msgResult.events)

            let balance = (await blockchain.getContract(setup.voteStatusList[0].address)).balance
            expect(balance).toEqual(toNano("0.01"))
        });

    });

    describe("VoteStorage get methods", () => {

        it('should get data', async () => {
            const setup = await voteSetup(deployer, true)

            let data = await setup.voteStorage.getVoteStorageData()
            
            expectEqAddress(data.registerAddress, setup.register)
            expectEqAddress(data.voteAddress, jetton)
            expect(data.positiveVotes).toEqual(validUsers.length)
            expect(data.negativeVotes).toEqual(0)
        });

        it('should get vote status address', async () => {
            const setup = await voteSetup(deployer, true)

            let data = await setup.voteStorage.getVoteStatusAddress(validUsers[0].address)
            
            expectEqAddress(data, setup.voteStatusList[0].address)

        });
    });

    describe("Functionality", () => {
        it('should deploy register', async () => {
            const register = await deployRegister(deployer);
        });

        it('should claim admin status', async () => {
            const setup = await basicSetup(deployer)
            const newAdmin = validUsers[0]

            let msgResult = await setup.register.sendChangeAdmin(deployer.getSender(), {
                value: toNano(1),
                newAdminAddress: newAdmin.address
            })
            expectNotBounced(msgResult.events)

            let data = await setup.register.getRegisterData()
            expectEqAddress(data.adminPendingAddress as Address, newAdmin)

            msgResult = await setup.register.sendClaimAdmin(newAdmin.getSender(), toNano(1))
            expectNotBounced(msgResult.events)

            data = await setup.register.getRegisterData()
            expectEqAddress(data.adminAddress as Address, newAdmin)
            expectNullAddress(data.adminPendingAddress)
        });

        it('should cast positive votes', async () => {
            const setup = await voteSetup(deployer, true)
        });

        it('should cast negative votes', async () => {
            const setup = await voteSetup(deployer, false)
        });

        it('should reset positive vote', async () => {
            const setup = await voteSetup(deployer, true)

            const target = validUsers[0]
            const tgStatus = setup.voteStatusList[0]
            let msgResult = await setup.register.sendCastVote(target.getSender(), {
                value: toNano(1),
                voteAddress: jetton.address,
                posVote: 0,
                negVote: 0,
            })
            expectNotBounced(msgResult.events)

            let data = await setup.voteStorage.getVoteStorageData()
            expect(data.positiveVotes).toEqual(validUsers.length - 1)
            expect(data.negativeVotes).toEqual(0)

            let accData = await tgStatus.getVoteStatusData()
            expect(accData.positiveVote).toEqual(0)
            expect(accData.negativeVote).toEqual(0)
        });

        it('should reset negative vote', async () => {
            const setup = await voteSetup(deployer, false)

            const target = validUsers[0]
            const tgStatus = setup.voteStatusList[0]
            let msgResult = await setup.register.sendCastVote(target.getSender(), {
                value: toNano(1),
                voteAddress: jetton.address,
                posVote: 0,
                negVote: 0,
            })
            expectNotBounced(msgResult.events)

            let data = await setup.voteStorage.getVoteStorageData()
            expect(data.positiveVotes).toEqual(0)
            expect(data.negativeVotes).toEqual(validUsers.length - 1)

            let accData = await tgStatus.getVoteStatusData()
            expect(accData.positiveVote).toEqual(0)
            expect(accData.negativeVote).toEqual(0)
        });

        it('should ignore if cast the same vote', async () => {
            const setup = await voteSetup(deployer, true)

            const target = validUsers[0]
            let msgResult = await setup.register.sendCastVote(target.getSender(), {
                value: toNano(1),
                voteAddress: jetton.address,
                posVote: 1,
                negVote: 0,
            })
            expectNotBounced(msgResult.events)

            let data = await setup.voteStatusList[0].getVoteStatusData()

            expect(data.positiveVote).toEqual(1)
            expect(data.negativeVote).toEqual(0)

        });

        it('should change vote from pos to neg', async () => {
            const setup = await voteSetup(deployer, true)

            const target = validUsers[0]
            let msgResult = await setup.register.sendCastVote(target.getSender(), {
                value: toNano(1),
                voteAddress: jetton.address,
                posVote: 0,
                negVote: 1,
            })
            expectNotBounced(msgResult.events)

            let data = await setup.voteStatusList[0].getVoteStatusData()

            expect(data.positiveVote).toEqual(0)
            expect(data.negativeVote).toEqual(1)

            let data2 = await setup.voteStorage.getVoteStorageData()
            expect(data2.negativeVotes).toEqual(1)

        });
        
        it('should change vote from neg to pos', async () => {
            const setup = await voteSetup(deployer, false)

            const target = validUsers[0]
            let msgResult = await setup.register.sendCastVote(target.getSender(), {
                value: toNano(1),
                voteAddress: jetton.address,
                posVote: 1,
                negVote: 0,
            })
            expectNotBounced(msgResult.events)

            let data = await setup.voteStatusList[0].getVoteStatusData()

            expect(data.positiveVote).toEqual(1)
            expect(data.negativeVote).toEqual(0)

            let data2 = await setup.voteStorage.getVoteStorageData()
            expect(data2.positiveVotes).toEqual(1)

        });

        it('should ignore empty messages (register)', async () => {
            const setup = await voteSetup(deployer, true)

            let msgResult = await setup.register.sendEmpty(deployer.getSender(), toNano(1))

            expectNotBounced(msgResult.events)
        });

        it('should ignore empty messages (storage)', async () => {
            const setup = await voteSetup(deployer, true)

            let msgResult = await setup.voteStorage.sendEmpty(deployer.getSender(), toNano(1))

            expectNotBounced(msgResult.events)
        });
        
        it('should ignore empty messages (status)', async () => {
            const setup = await voteSetup(deployer, true)

            let msgResult = await setup.voteStatusList[0].sendEmpty(deployer.getSender(), toNano(1))

            expectNotBounced(msgResult.events)
        });
    });

    describe("Register admin calls", () => {

        it('should bounce non-admin calls', async () => {
            const setup = await voteSetup(deployer, true)
            const target = invalidUsers[0]

            let msgResult = await setup.register.sendAddVoter(target.getSender(), {
                value: toNano(1),
                voterAddress: deployer.address
            })
            expectBounced(msgResult.events)

            msgResult = await setup.register.sendRemoveVoter(target.getSender(), {
                value: toNano(1),
                voterAddress: target.address
            })
            expectBounced(msgResult.events)

            msgResult = await setup.register.sendResetGas(target.getSender(), toNano(1))
            expectBounced(msgResult.events)

            msgResult = await setup.register.sendChangeAdmin(target.getSender(), {
                value: toNano(1),
                newAdminAddress: target.address
            })
            expectBounced(msgResult.events)

            msgResult = await setup.register.sendResetGasStorage(target.getSender(), {
                value: toNano(1),
                voteAddress: jetton.address
            })
            expectBounced(msgResult.events)
        });

        it('should add voters', async () => {
            const setup = await basicSetup(deployer)

            let msgResult = await setup.register.sendAddVoter(deployer.getSender(), {
                value: toNano(1),
                voterAddress: deployer.address
            })
            expectNotBounced(msgResult.events)

            let data = await setup.register.getRegisterData()
            expectContainsAddress(data.addressList, deployer.address)
        });

        it('should remove voters', async () => {
            const setup = await basicSetup(deployer)
            const target = validUsers[0]

            let msgResult = await setup.register.sendRemoveVoter(deployer.getSender(), {
                value: toNano(1),
                voterAddress: target.address
            })
            expectNotBounced(msgResult.events)

            let data = await setup.register.getRegisterData()
            expectNotContainsAddress(data.addressList, target.address)
        });

        it('should reset register gas', async () => {
            const setup = await basicSetup(deployer)

            let msgResult = await setup.register.sendResetGas(deployer.getSender(), toNano(1))
            expectNotBounced(msgResult.events)

            let balance = (await blockchain.getContract(setup.register.address)).balance
            expect(balance).toEqual(toNano("0.1"))
        });

        it('should set new pending admin', async () => {
            const setup = await basicSetup(deployer)
            const newAdmin = validUsers[0]

            let msgResult = await setup.register.sendChangeAdmin(deployer.getSender(), {
                value: toNano(1),
                newAdminAddress: newAdmin.address
            })
            expectNotBounced(msgResult.events)

            let data = await setup.register.getRegisterData()
            expectEqAddress(data.adminPendingAddress as Address, newAdmin)
        });

        it('should reset storage gas', async () => {
            const setup = await voteSetup(deployer, true)

            let msgResult = await setup.register.sendResetGasStorage(deployer.getSender(), {
                value: toNano(1),
                voteAddress: jetton.address
            })
            
            expectNotBounced(msgResult.events)

            let balance = (await blockchain.getContract(setup.voteStorage.address)).balance
            expect(balance).toEqual(toNano("0.05"))
            
        });
    });

});