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
    StackSlice,
    Slice
} from "ton";

import { SmartContract } from "@ton-community/tx-emulator";

import {
    isBounced,
    randomAddress,
    getRegisterAddress,
    Dict,
    getVoteStatusAddress,
    opCodeList,
    getVoteStorage,
    parseAddressFromCell,
    reverseBN,
    wrongOpCode,
    getAddressDict
} from "./helpers";

import * as voteStorage from "../contracts/vote_storage";

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

async function getVoteStorageData(contract: SmartContract) {
    const getData = await contract.runGetMethod("get_vote_storage_data", []);
    expect(getData.exitCode).to.be.equal(0);

    // @ts-ignore
    const addrRegister = parseAddressFromCell(getData.stack[0].cell as Cell);
    // @ts-ignore
    const addrJetton = parseAddressFromCell(getData.stack[1].cell as Cell);
    // @ts-ignore
    const whiteVotes = getData.stack[2].value;
    // @ts-ignore
    const blackVotes = getData.stack[3].value;
    return {
        addressRegister: addrRegister as Address,
        addressJetton: addrJetton as Address,
        whiteVotes: whiteVotes as BN,
        blackVotes: blackVotes as BN
    }
}

describe("vote_storage test", () => {
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
        
        contract = getVoteStorage(addressList, jetton);
    });

    it("should get vote status address", async () => {
        const getArg: StackSlice = {
            type: "slice",
            cell: beginCell().storeAddress(alice).endCell()
        }
        const storageAddress = getVoteStatusAddress(addressList, jetton, alice)

        const getData = await contract.runGetMethod("get_vote_status_address", [getArg]);
        expect(getData.exitCode).to.be.equal(0);

        // @ts-ignore
        const addrStorage = (getData.stack[0].cell as Cell).beginParse().readAddress();

        expect(storageAddress.toString()).to.be.eq(addrStorage?.toString())

    });

    it("should bounce on wrong op code", async () => {
        const ctxFun = async () => {
            const msgBody = await sendMessage({
                contract: contract,
                fromAddress: getRegisterAddress(addressList),
                msgBody: wrongOpCode(),
                expectBounce: true
            });
        };

        await ctxFun();

    });

    it("should ignore empty messages", async () => {
        const resultVoteCast = await contract.sendMessage(new InternalMessage({
            to: contract.getAddress(),
            from: alice,
            value: MESSAGE_GAS,
            bounce: true,
            body: new CommonMessageInfo({
                body: new CellMessage(beginCell().endCell())
            }),
        }));

        expect(resultVoteCast.transaction.outMessages.length).to.be.eq(0);

    });

    it("should deploy storage for jetton", async () => {
        const getData = await getVoteStorageData(contract)

        expect(getData.addressRegister.toString()).to.be.eq(getRegisterAddress(addressList).toString());
        expect(getData.addressJetton.toString()).to.be.eq(jetton.toString());
        expect(getData.whiteVotes).to.be.bignumber.eq(new BN(0));
        expect(getData.blackVotes).to.be.bignumber.eq(new BN(0));

    });

    it("should bounce user calls", async () => {
        const ctxFun = async (sender: Address) => {
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: sender,
                msgBody: voteStorage.castVote({
                    voterAddress: sender,
                    posVotes: new BN(1),
                    negVotes: new BN(0)
                }),
                expectBounce: true
            }) as Slice;
        };

        for (let user of validUsers.concat(invalidUsers)) {
            await ctxFun(user);
        }

    });

    it("should accept register calls", async () => {
        const ctxFun = async (user: Address, value: BN) => {
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: getRegisterAddress(addressList),
                msgBody: voteStorage.castVote({
                    voterAddress: user,
                    posVotes: value,
                    negVotes: reverseBN(value)
                }),
            }) as Slice;

            const opCode = msgBody.readUint(32);
            const qId = msgBody.readUint(64);
            const whiteVote = msgBody.readUint(1);
            const blackVote = msgBody.readUint(1);

            // verify content
            expect(opCode).to.be.bignumber.eq(opCodeList.verify_vote);
            expect(whiteVote).to.be.bignumber.equal(value);
            expect(blackVote).to.be.bignumber.equal(reverseBN(value));

        };

        for (let user of validUsers) {
            await ctxFun(user, new BN(0));
            await ctxFun(user, new BN(1));
        }
    });

    it("should accept user status initial vote", async () => {
        const ctxFun = async (user: Address, value: BN) => {
            contract = getVoteStorage(addressList, jetton);

            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStatusAddress(addressList, jetton, user),
                msgBody: voteStorage.addVote({
                    voterAddress: user,
                    posAdd: value,
                    negAdd: reverseBN(value)
                }),
            }) as Slice;

            const getData = await getVoteStorageData(contract)

            expect(getData.whiteVotes).to.be.bignumber.eq(value);
            expect(getData.blackVotes).to.be.bignumber.eq(reverseBN(value));

        };

        for (let user of validUsers) {
            await ctxFun(user, new BN(0));
            await ctxFun(user, new BN(1));
        }
    });

    it("should accept votes of multiple users", async () => {
        const ctxFun = async (user: Address, value: BN, votesTotal: BN) => {
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStatusAddress(addressList, jetton, user),
                msgBody: voteStorage.addVote({
                    voterAddress: user,
                    posAdd: value,
                    negAdd: reverseBN(value)
                }),
            }) as Slice;

            const getData = await getVoteStorageData(contract)

            expect(getData.whiteVotes).to.be.bignumber.eq(value.toNumber() ? votesTotal : new BN(0));
            expect(getData.blackVotes).to.be.bignumber.eq(reverseBN(value).toNumber() ? votesTotal : new BN(0));

        };

        contract = getVoteStorage(addressList, jetton);
        let votesTotal = new BN(0);
        for (let user of validUsers) {
            votesTotal = votesTotal.add(new BN(1));
            await ctxFun(user, new BN(0), votesTotal);
        }

        contract = getVoteStorage(addressList, jetton);
        votesTotal = new BN(0);
        for (let user of validUsers) {
            votesTotal = votesTotal.add(new BN(1));
            await ctxFun(user, new BN(1), votesTotal);
        }
    });

    it("should change vote", async () => {
        const ctxFun = async (user: Address, white: BN, black: BN, exW: BN, exB: BN) => {
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: getVoteStatusAddress(addressList, jetton, user),
                msgBody: voteStorage.addVote({
                    voterAddress: user,
                    posAdd: white,
                    negAdd: black
                }),
            }) as Slice;

            const getData = await getVoteStorageData(contract)

            expect(getData.whiteVotes).to.be.bignumber.eq(exW);
            expect(getData.blackVotes).to.be.bignumber.eq(exB);

        };


        contract = getVoteStorage(addressList, jetton);
        await ctxFun(alice, new BN(1), new BN(0), new BN(1), new BN(0));
        await ctxFun(bob, new BN(1), new BN(0), new BN(2), new BN(0));
        await ctxFun(alice, new BN(-1), new BN(1), new BN(1), new BN(1));

        contract = getVoteStorage(addressList, jetton);
        await ctxFun(alice, new BN(0), new BN(1), new BN(0), new BN(1));
        await ctxFun(bob, new BN(0), new BN(1), new BN(0), new BN(2));
        await ctxFun(alice, new BN(1), new BN(-1), new BN(1), new BN(1));

    });

    it("should reset gas", async () => {

        const ctxFun = async () => {            
            let msgBody = await sendMessage({
                contract: contract,
                fromAddress: getRegisterAddress(addressList),
                msgBody: voteStorage.resetGas({
                    adminAddress: alice
                }),
                outMsgAddress: alice
            }) as Slice;
        };

        await ctxFun();

        // const ctrBalance = contract.getBalance()
        // console.log(ctrBalance.toNumber())
    });

});