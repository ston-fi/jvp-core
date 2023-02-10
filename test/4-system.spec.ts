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
} from "ton";

import { SmartContract } from "@ton-community/tx-emulator";

import {
    randomAddress,
    getRegister,
    Dict,
    getVoteStorageAddress,
    getVoteStorage,
    parseAddressFromCell,
    reverseBN,
    getVoteStatus,
    getAddressDict
} from "./helpers";

import { TonTestingPipe, InitContactMap, EmptyAccount } from "./pipeline";

import * as register from "../contracts/register";

chai.use(chaiBN(BN));

const MESSAGE_GAS = toNano(1); // use 1 ton in any message

async function getVoteStorageData(pipe: TonTestingPipe, ctxAddress: Address) {
    const getData = await pipe.queryContract(ctxAddress, "get_vote_storage_data");

    // @ts-ignore
    const addrRegister = parseAddressFromCell(getData.stack[0].cell as Cell);
    // @ts-ignore
    const addrJetton = parseAddressFromCell(getData.stack[1].cell as Cell);
    // @ts-ignore
    const whiteVotes = getData.stack[2].value;
    // @ts-ignore
    const blackVotes = getData.stack[3].value;

    return {
        addressRegister: addrRegister,
        addressJetton: addrJetton,
        whiteVotes: whiteVotes,
        blackVotes: blackVotes
    }
}

function getCastVoteMsg(params: {
    whiteVote: BN, 
    blackVote: BN, 
    jettonAddress: Address,
    toAddress: Address,
    fromAddress: Address,
    gas?: BN | number,
    bounce?: boolean
}) {
    const msg = new InternalMessage({
        to: params.toAddress,
        from: params.fromAddress,
        value: params.gas ?? MESSAGE_GAS,
        bounce: params.bounce ?? true,
        body: new CommonMessageInfo({
            body: new CellMessage(register.castVote({
                voteAddress: params.jettonAddress,
                posVote: params.whiteVote,
                negVote: params.blackVote
            }))
        }),
    });

    return msg
}

describe("pipeline test", () => {
    let ctrPipe: TonTestingPipe,
        jetton: Address,
        alice: Address,
        bob: Address,
        john: Address,
        jack: Address,
        validUsers: Address[],
        invalidUsers: Address[],
        addressList: Dict,
        ctxFun: (user: Address, value: BN) => Promise<void>,
        ctrRegister: SmartContract;


    beforeEach(async () => {
        alice = randomAddress('alice');
        bob = randomAddress('bob');
        john = randomAddress('john');
        jetton = randomAddress('jetton');
        jack = randomAddress('jack');

        validUsers = [alice, bob, jack];
        invalidUsers = [john];
        addressList = getAddressDict(validUsers);

        ctrRegister = getRegister(addressList);
        let ctrVoteStorage = getVoteStorage(addressList, jetton);
        
        let ctrMap: InitContactMap = [];

        ctrMap.push(
            [ctrRegister.getAddress(), ctrRegister],
            [ctrVoteStorage.getAddress(), ctrVoteStorage]
        );

        let ctrVoteStatus: SmartContract;
        for (let cUser of validUsers) {
            ctrVoteStatus = getVoteStatus(addressList, jetton, cUser);
            ctrMap.push(
                [ctrVoteStatus.getAddress(), ctrVoteStatus],
                [cUser, EmptyAccount]
            );

        }

        ctrPipe = new TonTestingPipe(ctrMap);

        ctxFun = async (user: Address, value: BN) => {
            await ctrPipe.pipeMessage(getCastVoteMsg({
                whiteVote: value,
                blackVote: reverseBN(value),
                jettonAddress: jetton,
                toAddress: ctrRegister.getAddress(),
                fromAddress: user
            }));
        };
    });

    it("should cast white vote", async () => {
        const vsAddress = getVoteStorageAddress(addressList, jetton);

        for (let user of validUsers) {
            await ctxFun(user, new BN(1));
        }

        const getData = await getVoteStorageData(ctrPipe, vsAddress)

        expect(getData.whiteVotes).to.be.bignumber.eq(new BN(validUsers.length));
        expect(getData.blackVotes).to.be.bignumber.eq(new BN(0));

    });

    it("should cast black vote", async () => {
        const vsAddress = getVoteStorageAddress(addressList, jetton);

        for (let user of validUsers) {
            await ctxFun(user, new BN(0));
        }

        const getData = await getVoteStorageData(ctrPipe, vsAddress)

        expect(getData.whiteVotes).to.be.bignumber.eq(new BN(0));
        expect(getData.blackVotes).to.be.bignumber.eq(new BN(validUsers.length));

    });

    it("should change vote", async () => {
        const vsAddress = getVoteStorageAddress(addressList, jetton);

        let user = validUsers[0];
        await ctxFun(user, new BN(0));
        await ctxFun(user, new BN(1));


        const getData = await getVoteStorageData(ctrPipe, vsAddress)

        expect(getData.whiteVotes).to.be.bignumber.eq(new BN(1));
        expect(getData.blackVotes).to.be.bignumber.eq(new BN(0));

    });
    it("should ignore same vote twice", async () => {
        const vsAddress = getVoteStorageAddress(addressList, jetton);

        let user = validUsers[0];
        await ctxFun(user, new BN(1));
        await ctxFun(user, new BN(1));


        const getData = await getVoteStorageData(ctrPipe, vsAddress)

        expect(getData.whiteVotes).to.be.bignumber.eq(new BN(1));
        expect(getData.blackVotes).to.be.bignumber.eq(new BN(0));

    });
    it("should ignore both votes set", async () => {
        const vsAddress = getVoteStorageAddress(addressList, jetton);

        ctxFun = async (user: Address, value: BN) => {
            await ctrPipe.pipeMessage(getCastVoteMsg({
                whiteVote: value,
                blackVote: value,
                jettonAddress: jetton,
                toAddress: ctrRegister.getAddress(),
                fromAddress: user
            }));
        };

        for (let user of validUsers) {
            await ctxFun(user, new BN(1));
        }

        const getData = await getVoteStorageData(ctrPipe, vsAddress)

        expect(getData.whiteVotes).to.be.bignumber.eq(new BN(0));
        expect(getData.blackVotes).to.be.bignumber.eq(new BN(0));

    });
    it("should reset positive votes", async () => {
        const vsAddress = getVoteStorageAddress(addressList, jetton);

        const ctxReset = async (user: Address) => {
            await ctrPipe.pipeMessage(getCastVoteMsg({
                whiteVote: new BN(0),
                blackVote: new BN(0),
                jettonAddress: jetton,
                toAddress: ctrRegister.getAddress(),
                fromAddress: user
            }));
        };


        for (let user of validUsers) {
            await ctxFun(user, new BN(1));
        }
        await ctxReset(validUsers[0])

        const getData = await getVoteStorageData(ctrPipe, vsAddress)

        expect(getData.whiteVotes).to.be.bignumber.eq(new BN(validUsers.length - 1));
        expect(getData.blackVotes).to.be.bignumber.eq(new BN(0));

    });
    it("should reset negative votes", async () => {
        const vsAddress = getVoteStorageAddress(addressList, jetton);
        
        const ctxReset = async (user: Address) => {
            await ctrPipe.pipeMessage(getCastVoteMsg({
                whiteVote: new BN(0),
                blackVote: new BN(0),
                jettonAddress: jetton,
                toAddress: ctrRegister.getAddress(),
                fromAddress: user
            }));
        };
        
        
        for (let user of validUsers) {
            await ctxFun(user, new BN(0));
        }
        await ctxReset(validUsers[0])

        const getData = await getVoteStorageData(ctrPipe, vsAddress)
        
        expect(getData.whiteVotes).to.be.bignumber.eq(new BN(0));
        expect(getData.blackVotes).to.be.bignumber.eq(new BN(validUsers.length - 1));
        
    });
    it("should reset cast vote after reset", async () => {
        const vsAddress = getVoteStorageAddress(addressList, jetton);

        const ctxReset = async (user: Address) => {
            await ctrPipe.pipeMessage(getCastVoteMsg({
                whiteVote: new BN(0),
                blackVote: new BN(0),
                jettonAddress: jetton,
                toAddress: ctrRegister.getAddress(),
                fromAddress: user
            }));
        };

        for (let user of validUsers) {
            await ctxFun(user, new BN(1));
        }
        await ctxReset(validUsers[0])

        let getData = await getVoteStorageData(ctrPipe, vsAddress)

        expect(getData.whiteVotes).to.be.bignumber.eq(new BN(validUsers.length - 1));
        expect(getData.blackVotes).to.be.bignumber.eq(new BN(0));

        await ctxFun(validUsers[0], new BN(1));

        getData = await getVoteStorageData(ctrPipe, vsAddress)

        expect(getData.whiteVotes).to.be.bignumber.eq(new BN(validUsers.length));
        expect(getData.blackVotes).to.be.bignumber.eq(new BN(0));
    });
});