import * as register from "../contracts/register";
import { randomAddress, getRandomInt, getMyAddress } from "../contracts/helpers";
import fs from "fs";
import { Cell, beginDict, beginCell, Address } from "ton";
import BN from "bn.js";
import dotenv from "dotenv";
import * as color from "../test/color"; 

dotenv.config();



export function initData() {
    // color.log("- <r><bld>Warning: A random address will be added to the list on deploy")
    const myAddress = getMyAddress();
    // const rndAddress = randomAddress(`rndaddress${getRandomInt(100000000)}`);
    
    // fs.writeFileSync("build/_rnd_addr.txt", rndAddress.toFriendly());

    const addressListBuilder = beginDict(256);
    // addressListBuilder.storeCell(new BN(myAddress.hash, "hex"), beginCell().endCell());
    // addressListBuilder.storeCell(new BN(rndAddress.hash, "hex"), beginCell().endCell());
    const addressList = addressListBuilder.endDict();

    return register.data({
        adminAddress: getMyAddress(),
        addressList: addressList,
        voteStatusCode: Cell.fromBoc(fs.readFileSync("build/vote_status.cell"))[0],
        voteStorageCode: Cell.fromBoc(fs.readFileSync("build/vote_storage.cell"))[0]
    });
}
export function initDataTest(addressList: Cell, admin?: Address) {

    return register.data({
        adminAddress: admin ?? getMyAddress(),
        addressList: addressList,
        voteStatusCode: Cell.fromBoc(fs.readFileSync("build/vote_status.cell"))[0],
        voteStorageCode: Cell.fromBoc(fs.readFileSync("build/vote_storage.cell"))[0]
    });
}

export function initMessage() {
    return null;
}

