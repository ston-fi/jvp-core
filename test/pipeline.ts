import BN from "bn.js";

import {
    Address,
    Cell,
    CellMessage,
    InternalMessage,
    CommonMessageInfo,
    toNano,
    InternalCommonMessageInfo,
} from "ton";

import { SmartContract, RunGetMethodResult } from "@ton-community/tx-emulator";

export class EmptyAccount { }

export type PipeMapField = SmartContract | EmptyAccount;
export type InitContactMap = Array<[Address, PipeMapField]>;

function isContract(x: any): x is SmartContract {
    return x instanceof SmartContract;
}

export class TonTestingPipe {
    readonly contractMap: Map<string, PipeMapField>;
    // pipeMessages: Array<InternalMessage>
    readonly msgGas: BN;

    constructor(initMap: InitContactMap, msgGas?: BN) {
        this.contractMap = new Map();
        for (let entry of initMap) {
            this.contractMap.set(entry[0].toString(), entry[1]);
        }
        this.msgGas = msgGas ?? toNano(1);
    }

    addContract(address: Address, contract: PipeMapField) {
        this.contractMap.set(address.toString(), contract);
    }

    getContract(address: Address) {
        return this.contractMap.get(address.toString());
    }

    async pipeMessage(msg: InternalMessage, depth?: number) {
        let targetContract = this.getContract(msg.to);
        // console.log(this.contractMap.keys());
        if (typeof targetContract === 'undefined') {
            throw new Error("target not found in 'contractMap'");
        }

        if (!isContract(targetContract)) {
            return;
        }

        let resultMessage = await targetContract.sendMessage(msg);

        let fwdMsgBody: Cell,
            fwdTo: Address,
            fwdFrom: Address,
            fwdMsg: InternalMessage,
            fwdBounce: boolean;

        for (let outMsg of resultMessage.transaction.outMessages) {
            fwdMsgBody = outMsg.body;
            fwdTo = outMsg.info.dest as Address;
            fwdFrom = outMsg.info.src as Address;
            fwdBounce = (outMsg.info as InternalCommonMessageInfo).bounce;

            fwdMsg = new InternalMessage({
                to: fwdTo,
                from: fwdFrom,
                value: this.msgGas,
                bounce: fwdBounce,
                body: new CommonMessageInfo({
                    body: new CellMessage(fwdMsgBody)
                }),
            });

            await this.pipeMessage(fwdMsg, (depth ?? 0) + 1);
        }
    }

    async queryContract(address: Address, getMethod: string): Promise<RunGetMethodResult> {
        let targetContract = this.getContract(address);
        if (typeof targetContract === 'undefined') {
            throw new Error("target not found in 'contractMap'");
        }
        if (!isContract(targetContract)) {
            throw new Error("target is not a contract");
        }
        return targetContract.runGetMethod(getMethod);
    }

}