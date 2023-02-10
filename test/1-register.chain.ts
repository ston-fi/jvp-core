import chai, { assert, expect } from "chai";
import chaiBN from "chai-bn";

import * as register from "../contracts/register";
import * as deploy from "./deploy";
import * as color from "./color";

import {
    Address,
    Cell,
    beginDict,
    beginCell,
    toNano,
    CellMessage,
    CommonMessageInfo,
    InternalMessage,
    TonClient,
    WalletContract,
    WalletV3R2Source,
    SendMode,
    parseDict
} from "ton";

import {
    randomAddress,
    getVoteStorageAddress,
    getClient,
    getAddressDict
} from "./helpers";

import { getHoleAddress, getRandomInt, parseRawCell } from "../contracts/helpers";

import { mnemonicToWalletKey, KeyPair } from "ton-crypto";
import BN from "bn.js";
import dotenv from "dotenv";

dotenv.config();
chai.use(chaiBN(BN));

const MESSAGE_GAS = toNano(1);
const WORKCHAIN = 0;

const JETTON_ADDRESS = Address.parseFriendly("EQCKt2WPGX-fh0cIAz38Ljd_OKQjoZE_cqk7QrYGsNP6wUh-").address;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

type MsgType = "add_voter" | "remove_voter" | "change_admin" | "claim_admin";
type EnvString = string | undefined;


async function getWallet(mnemonic: EnvString, envAddress: EnvString, client: TonClient) {
    let walletKey = await mnemonicToWalletKey((mnemonic as string).split(" "));
    let walletContract = WalletContract.create(client, WalletV3R2Source.create({ publicKey: walletKey.publicKey, workchain: WORKCHAIN }));
    let walletAddress = walletContract.address;

    assert(walletAddress.toFriendly() === envAddress, "wallet contract address doesn't match expected");
    return {
        walletKey: walletKey,
        walletContract: walletContract,
        walletAddress: walletAddress
    };
}

async function deployRegister(client: TonClient, walletKey: KeyPair, walletContract: WalletContract, ctxBuildDict: () => Cell) {
    let addrRegister: Address | null;
    let addressList;
    while (true) {
        addressList = ctxBuildDict();
        addrRegister = await deploy.deploy({
            contractFileName: "register",
            addressList: addressList,
            workchain: WORKCHAIN,
            client: client,
            walletKey: walletKey,
            walletContract: walletContract,
            newContractFunding: toNano(0.1)
        });
        if (addrRegister) break;
    }
    return {
        addressList: addressList,
        addressRegister: addrRegister
    };
}

async function sendMessage(params: {
    client: TonClient,
    walletContract: WalletContract,
    walletKey: KeyPair,
    msgBody: Cell,
    toAddress: Address;
    gas?: BN
}) {

    let seqno = await params.walletContract.getSeqNo();
    await sleep(2000);

    const transfer = params.walletContract.createTransfer({
        secretKey: params.walletKey.secretKey,
        seqno: seqno,
        sendMode: SendMode.PAY_GAS_SEPARATLY + SendMode.IGNORE_ERRORS,
        order: new InternalMessage({
            to: params.toAddress,
            value: params.gas ?? MESSAGE_GAS,
            bounce: true,
            body: new CommonMessageInfo({
                body: new CellMessage(params.msgBody),
            }),
        }),
    });
    color.log(` -<y> Sending a message...`);
    await params.client.sendExternalMessage(params.walletContract, transfer);
    await sleep(1000);

    let seqnoAfter;
    color.log(` -<y> Check if received...`);
    for (let attempt = 0; attempt < 30; attempt++) {
        await sleep(2500);
        seqnoAfter = await params.walletContract.getSeqNo();
        if (seqnoAfter > seqno) break;
    }
    expect(seqnoAfter).to.be.greaterThan(seqno);
    color.log(` - <g>Message received`);

}

async function getChainVoteStorageData(client: TonClient, addressList: Cell) {
    const addrStorage = getVoteStorageAddress(addressList, JETTON_ADDRESS);
    color.log(` -<y> Calling Storage get method...`);
    let getData = await client.callGetMethod(addrStorage, "get_vote_storage_data", []);

    // @ts-ignore
    const whiteVotesParsed = new BN(getData.stack[2][1].replace("0x", ""), 'hex');
    // @ts-ignore
    const blackVotesParsed = new BN(getData.stack[3][1].replace("0x", ""), 'hex');

    return {
        whiteVotes: whiteVotesParsed,
        blackVotes: blackVotesParsed
    };
}

async function getChainRegisterData(client: TonClient, addressRegister: Address) {
    color.log(` -<y> Calling Register get method...`);
    let getData = await client.callGetMethod(addressRegister, "get_register_data", []);

    const addrListCell = parseRawCell(getData.stack[2]);
    const addrMap = parseDict(addrListCell.beginParse(), 256, (slice) => {
        return null;
    });

    const keyList = [...addrMap.keys()];

    const addrAdmin = parseRawCell(getData.stack[0]).beginParse().readAddress() as Address;
    const addrPending = parseRawCell(getData.stack[1]).beginParse().readAddress() as Address;

    return {
        addressAdmin: addrAdmin,
        addressPending: addrPending,
        keyList: keyList,
    };
}

describe("on-chain register test", () => {
    let myAddress: Address,
        walletContract: WalletContract,
        walletKey: KeyPair,
        rndAddress: Address;

    const client = getClient(true);

    beforeEach(async () => {

        const walletDeployer = await getWallet(process.env.DEPLOYER_MNEMONIC, process.env.DEPLOYER_ADDRESS, client);
        walletKey = walletDeployer.walletKey;
        walletContract = walletDeployer.walletContract;
        myAddress = walletDeployer.walletAddress;

    });
    it("scenario #1: cast once", async () => {

        const ctxMsg = async (white: BN, black: BN) => {
            await sendMessage({
                client: client,
                walletContract: walletContract,
                walletKey: walletKey,
                msgBody: register.castVote({
                    voteAddress: JETTON_ADDRESS,
                    posVote: white,
                    negVote: black,
                }),
                toAddress: addrRegister
            });
        };

        let deployData = await deployRegister(client, walletKey, walletContract, () => {
            rndAddress = randomAddress(`rnd_address${getRandomInt(100000000)}`);
            return getAddressDict([myAddress, rndAddress]);
        });

        let addrRegister = deployData.addressRegister;
        let addressList = deployData.addressList;


        await ctxMsg(new BN(1), new BN(0));
        await ctxMsg(new BN(1), new BN(0));

        const dataStorage = await getChainVoteStorageData(client, addressList);

        expect(dataStorage.whiteVotes).to.be.bignumber.eq(new BN(1));
        expect(dataStorage.blackVotes).to.be.bignumber.eq(new BN(0));

        color.log(` - <g>SUCCESS!`);
    });
    it("scenario #2: vote change", async () => {

        const ctxMsg = async (white: BN, black: BN) => {
            await sendMessage({
                client: client,
                walletContract: walletContract,
                walletKey: walletKey,
                msgBody: register.castVote({
                    voteAddress: JETTON_ADDRESS,
                    posVote: white,
                    negVote: black,
                }),
                toAddress: addrRegister
            });
        };

        let deployData = await deployRegister(client, walletKey, walletContract, () => {
            rndAddress = randomAddress(`rnd_address${getRandomInt(100000000)}`);
            return getAddressDict([myAddress, rndAddress]);
        });

        let addrRegister = deployData.addressRegister;
        let addressList = deployData.addressList;

        await ctxMsg(new BN(1), new BN(0));
        await ctxMsg(new BN(0), new BN(1));

        const dataStorage = await getChainVoteStorageData(client, addressList);

        expect(dataStorage.whiteVotes).to.be.bignumber.eq(new BN(0));
        expect(dataStorage.blackVotes).to.be.bignumber.eq(new BN(1));

        color.log(` - <g>SUCCESS!`);
    });

    /*
    it("scenario #3: bloated address list", async () => {
    ;; test with a lot of users on list, commented out since it cost a lot of gas
        const ctxBuildDict = (): Cell => {
            const addressListBuilder = beginDict(256);
            addressListBuilder.storeCell(new BN(myAddress.hash, "hex"), beginCell().endCell());
            for (let i = 0; i < 999; i++) {
                rndAddress = randomAddress(`${i}rnd_address${getRandomInt(100000000)}`);
                addressListBuilder.storeCell(new BN(rndAddress.hash, "hex"), beginCell().endCell());
            }

            return addressListBuilder.endDict() as Cell;
        };

        const ctxMsg = async (white: BN, black: BN) => {
            let seqno = await walletContract.getSeqNo();
            await sleep(2000);

            const transfer = walletContract.createTransfer({
                secretKey: walletKey.secretKey,
                seqno: seqno,
                sendMode: SendMode.PAY_GAS_SEPARATLY + SendMode.IGNORE_ERRORS,
                order: new InternalMessage({
                    to: addrRegister as Address,
                    value: MESSAGE_GAS,
                    bounce: true,
                    body: new CommonMessageInfo({
                        body: new CellMessage(register.castVote({
                            jettonAddress: JETTON_ADDRESS,
                            whiteVote: white,
                            blackVote: black,
                        })),
                    }),
                }),
            });
            color.log(` -<y> Sending a message...`);
            await client.sendExternalMessage(walletContract, transfer);
            await sleep(1000);

            let seqnoAfter;
            color.log(` -<y> Check if received...`);
            for (let attempt = 0; attempt < 30; attempt++) {
                await sleep(2500);
                seqnoAfter = await walletContract.getSeqNo();
                if (seqnoAfter > seqno) break;
            }
            expect(seqnoAfter).to.be.greaterThan(seqno);
            color.log(` - <g>Message received`);
        };

        let addrRegister: Address | null;
        while (true) {
            addressList = ctxBuildDict();
            addrRegister = await deploy.deploy("register", addressList, WORKCHAIN, client, walletKey, walletContract, toNano(0.1));
            if (addrRegister) break;
        }

        await ctxMsg(new BN(1), new BN(0));

        const addrStorage = getVoteStorageAddress(addressList, JETTON_ADDRESS);
        color.log(` -<y> Calling Storage get method...`);
        let getData = await client.callGetMethod(addrStorage, "get_vote_storage_data", []);

        // @ts-ignore
        const whiteVotesParsed = new BN(getData.stack[2][1].replace("0x", ""), 'hex');
        // @ts-ignore
        const blackVotesParsed = new BN(getData.stack[3][1].replace("0x", ""), 'hex');

        expect(whiteVotesParsed).to.be.bignumber.eq(new BN(1));
        expect(blackVotesParsed).to.be.bignumber.eq(new BN(0));

        color.log(` - <g>SUCCESS!`);
    });
    */
});



describe("on-chain admin register test", () => {
    let myAddress: Address,
        claimAddress: Address,
        walletContract: WalletContract,
        walletContractClaim: WalletContract,
        walletKey: KeyPair,
        walletKeyClaim: KeyPair,
        rndAddress: Address,
        bob: Address,
        alice: Address;

    const client = getClient();

    beforeEach(async () => {
        const walletDeployer = await getWallet(process.env.DEPLOYER_MNEMONIC, process.env.DEPLOYER_ADDRESS, client);
        walletKey = walletDeployer.walletKey;
        walletContract = walletDeployer.walletContract;
        myAddress = walletDeployer.walletAddress;

        const walletClaimer = await getWallet(process.env.CLAIMER_MNEMONIC, process.env.CLAIMER_ADDRESS, client);
        walletKeyClaim = walletClaimer.walletKey;
        walletContractClaim = walletClaimer.walletContract;
        claimAddress = walletClaimer.walletAddress;

        alice = randomAddress('alice');
        bob = randomAddress('bob');
    });

    it("scenario #1: add and remove users", async () => {

        const ctxMsg = async (userAddress: Address, msgType: MsgType) => {
            let sendMsgBody = msgType === "add_voter" ?
                register.addVoter({
                    voterAddress: userAddress
                }) :
                register.removeVoter({
                    voterAddress: userAddress
                });

            await sendMessage({
                client: client,
                walletContract: walletContract,
                walletKey: walletKey,
                msgBody: sendMsgBody,
                toAddress: addrRegister
            });
        };

        let deployData = await deployRegister(client, walletKey, walletContract, () => {
            rndAddress = randomAddress(`rnd_address${getRandomInt(100000000)}`);
            return getAddressDict([myAddress, rndAddress, alice]);
        });

        let addrRegister = deployData.addressRegister;

        await ctxMsg(alice, "remove_voter");
        await ctxMsg(bob, "add_voter");

        let getData = await getChainRegisterData(client, addrRegister);
        let keyList = getData.keyList;

        color.log(` -<y> Checking data...`);

        const ctxCheck = (user: Address, result: boolean) => {
            expect(keyList.includes((new BN(user.hash, "hex")).toString(10))).to.be.eq(result);
        };

        ctxCheck(alice, false);
        ctxCheck(bob, true);

        color.log(` - <g>SUCCESS!`);
    });

    it("scenario #2: change admin", async () => {

        const ctxMsg = async (ctxContract: WalletContract, wKey: KeyPair, msgType: MsgType, userAddress?: Address) => {
            let sendMsgBody = msgType === "change_admin" ?
                register.changeAdmin({
                    newAdminAddress: userAddress as Address
                }) :
                register.claimAdmin();

            await sendMessage({
                client: client,
                walletContract: ctxContract,
                walletKey: wKey,
                msgBody: sendMsgBody,
                toAddress: addrRegister,
                gas: toNano(0.3)
            });
        };

        const ctxResetGas = async (ctxContract: WalletContract, wKey: KeyPair) => {
            await sendMessage({
                client: client,
                walletContract: ctxContract,
                walletKey: wKey,
                msgBody: register.resetGas(),
                toAddress: addrRegister,
                gas: toNano(0.3)
            });
        }

        let deployData = await deployRegister(client, walletKey, walletContract, () => {
            rndAddress = randomAddress(`rnd_address${getRandomInt(100000000)}`);
            return getAddressDict([myAddress, rndAddress]);
        });

        let addrRegister = deployData.addressRegister;

        await ctxMsg(walletContract, walletKey, "change_admin", claimAddress);

        let addrPending: Address,
            addrAdmin: Address;

        let getData = await getChainRegisterData(client, addrRegister);
        
        color.log(` -<y> Checking data...`);
        
        addrAdmin = getData.addressAdmin;
        addrPending = getData.addressPending;

        expect(addrPending.toString()).to.be.eq(claimAddress.toString());
        expect(addrAdmin.toString()).to.be.eq(myAddress.toString());
        color.log(` - <g>Data matched expected`);

        // can't test this without a 2nd wallet
        await ctxMsg(walletContractClaim, walletKeyClaim, "claim_admin");

        getData = await getChainRegisterData(client, addrRegister);

        color.log(` -<y> Checking data...`);

        addrAdmin = getData.addressAdmin;
        addrPending = getData.addressPending;

        expect(addrPending).to.be.eq(getHoleAddress());
        expect(addrAdmin.toString()).to.be.eq(claimAddress.toString());
        color.log(` - <g>Data matched expected`);

        color.log(` - <y>Resetting gas`);
        await ctxResetGas(walletContractClaim, walletKeyClaim)


        color.log(` - <g>SUCCESS!`);
    });

});