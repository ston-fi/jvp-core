import chai, { expect, use } from "chai";
import chaiBN from "chai-bn";
import BN from "bn.js";

import {
    Cell,
    beginCell,
    beginDict,
    Address,
    toNano,
    InternalMessage,
    CommonMessageInfo,
    CellMessage,
    parseDict,
    StackSlice,
    Slice
} from "ton";

import { SendMessageResult, SmartContract } from "@ton-community/tx-emulator";

import {
    isBounced,
    randomAddress,
    getRegister,
    Dict,
    getVoteStorageAddress,
    opCodeList,
    reverseBN,
    wrongOpCode,
    getAddressDict,
} from "./helpers";

import * as register from "../contracts/register";
import { getHoleAddress, getMyAddress } from "../contracts/helpers";

chai.use(chaiBN(BN));

const MESSAGE_GAS = toNano(1); // use 1 ton in any message

async function getRegisterData(contract: SmartContract) {
    const getData = await contract.runGetMethod("get_register_data", []);

    // @ts-ignore   
    const addrCellAdmin = (getData.stack[0].cell as Cell).beginParse().readAddress();
    // @ts-ignore
    const addrCellPending = (getData.stack[1].cell as Cell).beginParse().readAddress();

    // @ts-ignore
    const addrListCell = getData.stack[2].cell as Cell;

    const addrMap = parseDict(addrListCell.beginParse(), 256, (slice) => {
        return null;
    });

    const keyList = [...addrMap.keys()];

    return {
        addressAdmin: addrCellAdmin,
        addressPending: addrCellPending,
        keyList: keyList,
        exitCode: getData.exitCode
    };

}

async function sendMessage(params: {
    contract: SmartContract,
    msgBody: Cell,
    fromAddress: Address,
    toAddress?: Address,
    gas?: BN | number,
    bounce?: boolean,
    expectBounce?: boolean,
    expectReturn?: boolean,
    outMsgAddress?: Address;
}) {

    const result = await params.contract.sendMessage(new InternalMessage({
        to: params.toAddress ?? params.contract.getAddress(),
        from: params.fromAddress,
        value: params.gas ?? MESSAGE_GAS,
        bounce: params.bounce ?? true,
        body: new CommonMessageInfo({
            body: new CellMessage(params.msgBody)
        }),
    }));

    if (!( params.expectReturn ?? true)) {
        return null;
    }

    if (params.expectBounce) {
        expect(isBounced(result)).to.be.true;
        return null;
    }
    expect(isBounced(result)).to.be.false;

    const outInfo = result.transaction.outMessages[0].info;
    const msgBodyResult = result.transaction.outMessages[0].body.beginParse();

    if (typeof params.outMsgAddress !== "undefined") {
        // verify address of the next message
        expect(params.contract.getAddress().toString()).to.be.equal(outInfo.src?.toString());
        expect(params.outMsgAddress.toString()).to.be.equal(outInfo.dest?.toString());
    }

    return msgBodyResult;
}


describe("register test", () => {
    let contract: SmartContract,
        jetton: Address,
        alice: Address,
        bob: Address,
        john: Address,
        validUsers: Address[],
        invalidUsers: Address[],
        addressList: Dict;


    beforeEach(async () => {
        alice = randomAddress('alice');
        bob = randomAddress('bob');
        john = randomAddress('john');
        jetton = randomAddress('jetton');

        validUsers = [alice, bob];
        invalidUsers = [john];

        addressList = getAddressDict(validUsers);

        contract = getRegister(addressList);

    });
    it("should deploy register with a list", async () => {
        const getData = await getRegisterData(contract);
        expect(getData.exitCode).to.be.equal(0);

        const keyList = getData.keyList;

        const ctxFun = (user: Address, result: boolean) => {
            expect(keyList.includes((new BN(user.hash, "hex")).toString(10))).to.be.eq(result);
        };

        for (let user of validUsers) {
            ctxFun(user, true);
        }

        for (let user of invalidUsers) {
            ctxFun(user, false);
        }

    });
    it("should get vote storage address", async () => {
        const getArg: StackSlice = {
            type: "slice",
            cell: beginCell().storeAddress(jetton).endCell()
        };
        const storageAddress = getVoteStorageAddress(addressList, jetton);

        const getData = await contract.runGetMethod("get_vote_storage_address", [getArg]);
        expect(getData.exitCode).to.be.equal(0);

        // @ts-ignore
        const addrStorage = (getData.stack[0].cell as Cell).beginParse().readAddress();

        expect(storageAddress.toString()).to.be.eq(addrStorage?.toString());

    });

    it("should cast white vote", async () => {
        const ctxFun = async (sender: Address) => {
            const castWhiteVote = new BN(1);
            const castBlackVote = new BN(0);

            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: sender,
                msgBody: register.castVote({
                    jettonAddress: jetton,
                    whiteVote: castWhiteVote,
                    blackVote: castBlackVote
                }),
                outMsgAddress: getVoteStorageAddress(addressList, jetton)
            }) as Slice;


            const opCode = msgBody.readUint(32);
            const qId = msgBody.readUint(64);
            const senderAddress = msgBody.readAddress();
            const whiteVote = msgBody.readUint(1);
            const blackVote = msgBody.readUint(1);

            // verify content
            expect(opCode).to.be.bignumber.eq(opCodeList.cast_vote);
            expect(whiteVote).to.be.bignumber.equal(castWhiteVote);
            expect(blackVote).to.be.bignumber.equal(castBlackVote);
        };

        for (let user of validUsers) {
            await ctxFun(user);
        }

    });

    it("should cast black vote", async () => {
        const ctxFun = async (sender: Address) => {
            const castWhiteVote = new BN(0);
            const castBlackVote = new BN(1);

            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: sender,
                msgBody: register.castVote({
                    jettonAddress: jetton,
                    whiteVote: castWhiteVote,
                    blackVote: castBlackVote
                }),
                outMsgAddress: getVoteStorageAddress(addressList, jetton)
            }) as Slice;

            const opCode = msgBody.readUint(32);
            const qId = msgBody.readUint(64);
            const senderAddress = msgBody.readAddress();
            const whiteVote = msgBody.readUint(1);
            const blackVote = msgBody.readUint(1);

            // verify content
            expect(opCode).to.be.bignumber.eq(opCodeList.cast_vote);
            expect(whiteVote).to.be.bignumber.equal(castWhiteVote);
            expect(blackVote).to.be.bignumber.equal(castBlackVote);
        };

        for (let user of validUsers) {
            await ctxFun(user);
        }
    });

    it("should bounce on cast with same value", async () => {
        const ctxFun = async (sender: Address, value: BN) => {
            const msgBody = await sendMessage({
                contract: contract,
                fromAddress: sender,
                msgBody: register.castVote({
                    jettonAddress: jetton,
                    whiteVote: value,
                    blackVote: value
                }),
                expectBounce: true
            });
        };


        for (let user of validUsers) {
            await ctxFun(user, new BN(0));
            await ctxFun(user, new BN(1));
        }

    });
    it("should bounce a random user cast", async () => {
        const ctxFun = async (sender: Address, value: BN) => {
            const msgBody = await sendMessage({
                contract: contract,
                fromAddress: sender,
                msgBody: register.castVote({
                    jettonAddress: jetton,
                    whiteVote: value,
                    blackVote: reverseBN(value)
                }),
                expectBounce: true
            });
        };

        for (let user of invalidUsers) {
            await ctxFun(user, new BN(0));
            await ctxFun(user, new BN(1));
        }

    });
    it("should ignore empty messages", async () => {

        let resultVoteCast = await contract.sendMessage(new InternalMessage({
            to: contract.getAddress(),
            from: alice,
            value: MESSAGE_GAS,
            bounce: true,
            body: new CommonMessageInfo({
                body: new CellMessage(beginCell().endCell())
            }),
        }));

        expect(resultVoteCast.transaction.outMessages.length).to.be.eq(0);
        // expect(isBounced(resultVoteCast)).to.be.true;

    });

    it("should accept non-bounce empty messages", async () => {

        let resultVoteCast = await contract.sendMessage(new InternalMessage({
            to: contract.getAddress(),
            from: alice,
            value: MESSAGE_GAS,
            bounce: false,
            body: new CommonMessageInfo({
                body: new CellMessage(beginCell().endCell())
            }),
        }));

        expect(resultVoteCast.transaction.outMessages.length).to.be.eq(0);

    });

    it("should bounce if not enough gas", async () => {
        const ctxFun = async (sender: Address) => {
            const msgBody = await sendMessage({
                contract: contract,
                fromAddress: sender,
                msgBody: register.castVote({
                    jettonAddress: jetton,
                    whiteVote: new BN(1),
                    blackVote: new BN(0)
                }),
                gas: toNano(0.01),
                expectBounce: true
            });
        };

        for (let user of validUsers) {
            await ctxFun(user);
        }

    });

    it("should bounce on wrong op code", async () => {
        const ctxFun = async (sender: Address) => {
            const msgBody = await sendMessage({
                contract: contract,
                fromAddress: sender,
                msgBody: wrongOpCode(),
                expectBounce: true
            });
        };

        await ctxFun(alice);

    });
});

describe("register admin test", () => {
    let contract: SmartContract,
        alice: Address,
        bob: Address,
        mark: Address,
        john: Address,
        admin: Address,
        jetton: Address,
        validUsers: Address[],
        invalidUsers: Address[],
        addressList: Dict;

    beforeEach(async () => {
        alice = randomAddress('alice');
        bob = randomAddress('bob');
        john = randomAddress('john');
        mark = randomAddress('mark');
        admin = randomAddress('admin');
        jetton = randomAddress('jetton');

        validUsers = [alice, bob, admin];
        invalidUsers = [john];

        addressList = getAddressDict(validUsers);

        contract = getRegister(addressList, admin);
    });

    it("admin should add address to list", async () => {

        const ctxFun = async (userAddress: Address) => {
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: admin,
                msgBody: register.addUser({
                    userAddress: userAddress
                }),
                outMsgAddress: admin
            }) as Slice;
        };

        await ctxFun(john);

        const getData = await getRegisterData(contract);
        expect(getData.exitCode).to.be.equal(0);

        const keyList = getData.keyList;

        const ctxCheck = (user: Address, result: boolean) => {
            expect(keyList.includes((new BN(user.hash, "hex")).toString(10))).to.be.eq(result);
        };

        ctxCheck(john, true);
        ctxCheck(mark, false);
    });
    it("admin should remove address from list", async () => {

        const ctxFun = async (userAddress: Address) => {
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: admin,
                msgBody: register.removeUser({
                    userAddress: userAddress
                }),
                outMsgAddress: admin
            }) as Slice;
        };

        await ctxFun(alice);

        const getData = await getRegisterData(contract);
        expect(getData.exitCode).to.be.equal(0);

        const keyList = getData.keyList;

        const ctxCheck = (user: Address, result: boolean) => {
            expect(keyList.includes((new BN(user.hash, "hex")).toString(10))).to.be.eq(result);
        };

        ctxCheck(alice, false);
        ctxCheck(bob, true);
    });
    it("admin should setup admin change", async () => {

        const ctxFun = async (newAdmin: Address) => {
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: admin,
                msgBody: register.changeAdmin({
                    userAddress: newAdmin
                }),
                outMsgAddress: admin
            }) as Slice;
        };

        await ctxFun(alice);

        const getData = await getRegisterData(contract);
        expect(getData.exitCode).to.be.equal(0);

        const addrCell = getData.addressPending;

        expect(addrCell?.toString()).to.be.eq(alice.toString());
    });
    it("new admin should claim admin status", async () => {

        const ctxFun = async (newAdmin: Address) => {            
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: admin,
                msgBody: register.changeAdmin({
                    userAddress: newAdmin
                }),
                outMsgAddress: admin
            }) as Slice;

            msgBody = await sendMessage({
                contract: contract,
                fromAddress: newAdmin,
                msgBody: register.claimAdmin(),
                outMsgAddress: newAdmin,
                expectReturn: false
            }) as Slice;
        };

        await ctxFun(alice);

        const getData = await getRegisterData(contract);
        expect(getData.exitCode).to.be.equal(0);

        const addrCellPending = getData.addressPending;
        const addrCellAdmin = getData.addressAdmin;

        expect(addrCellPending).to.be.eq(getHoleAddress());
        expect(addrCellAdmin?.toString()).to.be.eq(alice.toString());
    });

    it("admin should call reset gas on storage", async () => {
        const voteStorageAddress = getVoteStorageAddress(addressList, jetton, admin) 
        const ctxFun = async () => {            
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: admin,
                msgBody: register.resetGasStorage({
                    jettonAddress: jetton
                }),
                outMsgAddress: voteStorageAddress
            }) as Slice;

            const opCode = msgBody.readUint(32);
            const qId = msgBody.readUint(64);
            const adminAddress = msgBody.readAddress();

            // verify content
            expect(opCode).to.be.bignumber.eq(opCodeList.reset_gas);
            expect(adminAddress?.toString()).to.be.equal(admin.toString());

        };

        await ctxFun();

    });
    it("admin should call reset gas", async () => {

        const ctxFun = async () => {            
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: admin,
                msgBody: register.resetGas(),
                outMsgAddress: admin
            }) as Slice;
        };

        await ctxFun();

        const getData = await getRegisterData(contract);
        expect(getData.exitCode).to.be.equal(0);

        // const ctrBalance = contract.getBalance()
        // console.log(ctrBalance.toNumber())
    });


});