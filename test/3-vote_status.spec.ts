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
    Slice,
} from "ton";

import { SendMessageResult, SmartContract } from "@ton-community/tx-emulator";

import {
    isBounced,
    randomAddress,
    Dict,
    getVoteStorageAddress,
    opCodeList,
    parseAddressFromCell,
    reverseBN,
    wrongOpCode,
    getVoteStatus,
    getAddressDict
} from "./helpers";

import * as voteStatus from "../contracts/vote_status";

chai.use(chaiBN(BN));

const MESSAGE_GAS = toNano(1); // use 1 ton in any message

async function sendMessage(params: {
    contract: SmartContract,
    msgBody: Cell,
    fromAddress: Address,
    toAddress?: Address,
    gas?: BN | number,
    bounce?: boolean,
    expectBounce?: boolean,
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

async function getVoteStatusData(contract: SmartContract) {
    const getData = await contract.runGetMethod("get_vote_status_data", []);
    expect(getData.exitCode).to.be.equal(0);

    // @ts-ignore
    const addrJetton = parseAddressFromCell(getData.stack[0].cell as Cell);
    // @ts-ignore
    const addrUser = parseAddressFromCell(getData.stack[1].cell as Cell);
    // @ts-ignore
    const addrStorage = parseAddressFromCell(getData.stack[2].cell as Cell);
    // @ts-ignore
    const whiteVote = getData.stack[3].value;
    // @ts-ignore
    const blackVote = getData.stack[4].value;

    return {
        addressJetton: addrJetton as Address,
        addressUser: addrUser as Address,
        addressStorage: addrStorage as Address,
        whiteVote: whiteVote as BN,
        blackVote: blackVote as BN
    }
}

describe("vote_status test", () => {
    let contract: SmartContract,
        jetton: Address,
        alice: Address,
        bob: Address,
        john: Address,
        validUsers: Array<Address>,
        invalidUsers: Array<Address>,
        addressList: Dict;


    beforeEach(async () => {
        alice = randomAddress('alice');
        bob = randomAddress('bob');
        john = randomAddress('john');
        jetton = randomAddress('jetton');

        validUsers = [alice, bob];
        invalidUsers = [john];
        addressList = getAddressDict(validUsers);
    });

    it("should bounce on wrong op code", async () => {
        const ctxFun = async (user: Address) => {
            contract = getVoteStatus(addressList, jetton, user);
            const msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStorageAddress(addressList, jetton),
                msgBody: wrongOpCode(),
                expectBounce: true
            });
        };

        await ctxFun(alice);

    });

    it("should ignore empty messages", async () => {
        contract = getVoteStatus(addressList, jetton, alice);
        const resultVoteCast = await contract.sendMessage(new InternalMessage({
            to: contract.getAddress(),
            from: getVoteStorageAddress(addressList, jetton),
            value: MESSAGE_GAS,
            bounce: true,
            body: new CommonMessageInfo({
                body: new CellMessage(beginCell().endCell())
            }),
        }));

        expect(resultVoteCast.transaction.outMessages.length).to.be.eq(0);

    });

    it("should deploy status for user", async () => {
        contract = getVoteStatus(addressList, jetton, alice);
        const getData = await getVoteStatusData(contract)

        // verify storage
        expect(getData.addressJetton.toString()).to.be.eq(jetton.toString());
        expect(getData.addressUser.toString()).to.be.eq(alice.toString());
        expect(getData.addressStorage.toString()).to.be.eq(getVoteStorageAddress(addressList, jetton).toString());
        expect(getData.whiteVote).to.be.bignumber.eq(new BN(0));
        expect(getData.blackVote).to.be.bignumber.eq(new BN(0));

    });

    it("should bounce user calls", async () => {
        const ctxFun = async (sender: Address) => {
            contract = getVoteStatus(addressList, jetton, sender);
            const msgBody = await sendMessage({
                contract: contract,
                fromAddress: sender,
                msgBody: voteStatus.verifyVote({
                    posVote: new BN(1),
                    negVote: new BN(0)
                }),
                expectBounce: true
            });
        };

        await ctxFun(alice);

    });

    it("should accept storage init calls", async () => {
        const ctxFun = async (user: Address, value: BN) => {
            contract = getVoteStatus(addressList, jetton, user);
            const msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStorageAddress(addressList, jetton),
                msgBody: voteStatus.verifyVote({
                    posVote: value,
                    negVote: reverseBN(value)
                }),
                outMsgAddress: getVoteStorageAddress(addressList, jetton)
            }) as Slice;

            const opCode = msgBody.readUint(32);
            const qId = msgBody.readUint(64);
            const userAddress = msgBody.readAddress();
            const whiteAdd = msgBody.readInt(2);
            const blackAdd = msgBody.readInt(2);

            // verify content
            expect(opCode).to.be.bignumber.eq(opCodeList.add_vote);
            expect(userAddress?.toString()).to.be.eq(user.toString());
            expect(whiteAdd).to.be.bignumber.equal(value);
            expect(blackAdd).to.be.bignumber.equal(reverseBN(value));

            // verify storage
            const getData = await getVoteStatusData(contract)

            expect(getData.whiteVote).to.be.bignumber.eq(value);
            expect(getData.blackVote).to.be.bignumber.eq(reverseBN(value));
        };


        await ctxFun(alice, new BN(0));
        await ctxFun(alice, new BN(1));

    });
    it("should return gas on same vote", async () => {
        const ctxFun = async (user: Address, value: BN) => {
            contract = getVoteStatus(addressList, jetton, user);
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStorageAddress(addressList, jetton),
                msgBody: voteStatus.verifyVote({
                    posVote: value,
                    negVote: reverseBN(value)
                }),
                outMsgAddress: getVoteStorageAddress(addressList, jetton)
            }) as Slice;

            msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStorageAddress(addressList, jetton),
                msgBody: voteStatus.verifyVote({
                    posVote: value,
                    negVote: reverseBN(value)
                }),
                outMsgAddress: user
            }) as Slice;

            // verify storage
            const getData = await getVoteStatusData(contract)

            expect(getData.whiteVote).to.be.bignumber.eq(value);
            expect(getData.blackVote).to.be.bignumber.eq(reverseBN(value));
        };


        await ctxFun(alice, new BN(0));
        await ctxFun(alice, new BN(1));


    });

    it("should accept storage change vote calls", async () => {
        const getAddVal = (val: BN) => {
            return val.toNumber() ? new BN(1) : new BN(-1);
        };

        const ctxFun = async (user: Address, value: BN) => {
            contract = getVoteStatus(addressList, jetton, user);

            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStorageAddress(addressList, jetton),
                msgBody: voteStatus.verifyVote({
                    posVote: reverseBN(value),
                    negVote: value
                }),
                outMsgAddress: getVoteStorageAddress(addressList, jetton)
            }) as Slice;

            msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStorageAddress(addressList, jetton),
                msgBody: voteStatus.verifyVote({
                    posVote: value,
                    negVote: reverseBN(value)
                }),
                outMsgAddress: getVoteStorageAddress(addressList, jetton)
            }) as Slice;

            const opCode = msgBody.readUint(32);
            const qId = msgBody.readUint(64);
            const userAddress = msgBody.readAddress();
            const whiteAdd = msgBody.readInt(2);
            const blackAdd = msgBody.readInt(2);

            // verify content
            expect(opCode).to.be.bignumber.eq(opCodeList.add_vote);
            expect(userAddress?.toString()).to.be.eq(user.toString());
            expect(whiteAdd).to.be.bignumber.equal(getAddVal(value));
            expect(blackAdd).to.be.bignumber.equal(getAddVal(reverseBN(value)));

            // verify storage
            const getData = await getVoteStatusData(contract)

            expect(getData.whiteVote).to.be.bignumber.eq(value);
            expect(getData.blackVote).to.be.bignumber.eq(reverseBN(value));

        };

        await ctxFun(alice, new BN(0));
        await ctxFun(alice, new BN(1));

    });
    it("should accept storage reset vote calls", async () => {
        const getAddVal = (val: BN) => {
            return val.toNumber() ? new BN(-1) : new BN(0);
        };

        const ctxFun = async (user: Address, value: BN) => {
            contract = getVoteStatus(addressList, jetton, user);

            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStorageAddress(addressList, jetton),
                msgBody: voteStatus.verifyVote({
                    posVote: value,
                    negVote: reverseBN(value)
                }),
                outMsgAddress: getVoteStorageAddress(addressList, jetton)
            }) as Slice;

            msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStorageAddress(addressList, jetton),
                msgBody: voteStatus.verifyVote({
                    posVote: new BN(0),
                    negVote: new BN(0)
                }),
                outMsgAddress: getVoteStorageAddress(addressList, jetton)
            }) as Slice;

            const opCode = msgBody.readUint(32);
            const qId = msgBody.readUint(64);
            const userAddress = msgBody.readAddress();
            const whiteAdd = msgBody.readInt(2);
            const blackAdd = msgBody.readInt(2);

            // verify content
            expect(opCode).to.be.bignumber.eq(opCodeList.add_vote);
            expect(userAddress?.toString()).to.be.eq(user.toString());
            expect(whiteAdd).to.be.bignumber.equal(getAddVal(value));
            expect(blackAdd).to.be.bignumber.equal(getAddVal(reverseBN(value)));

            // verify storage
            const getData = await getVoteStatusData(contract)

            expect(getData.whiteVote).to.be.bignumber.eq(new BN(0));
            expect(getData.blackVote).to.be.bignumber.eq(new BN(0));

        };

        await ctxFun(alice, new BN(0));
        await ctxFun(alice, new BN(1));

    });

    it("user should call reset gas", async () => {

        const ctxFun = async (sender: Address) => {
            contract = getVoteStatus(addressList, jetton, sender);
            const msgBody = await sendMessage({
                contract: contract,
                fromAddress: sender,
                msgBody: voteStatus.resetGas(),
                outMsgAddress: sender
            });
        };

        await ctxFun(alice);

        // const ctrBalance = contract.getBalance()
        // console.log(ctrBalance.toNumber())
    });
});