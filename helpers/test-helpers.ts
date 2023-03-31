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

export function expectEqAddress(received: Address | SandboxContract<Contract>, compare: Address | SandboxContract<Contract>) {
    if (!(received instanceof Address)) {
        received = received.address;
    }
    if (!(compare instanceof Address)) {
        compare = compare.address;
    }
    expect(received.toString()).toEqual(compare.toString());
}
export function expectNullAddress(received: Address | null) {
    expect(received).toEqual(null);
}

export function expectNotBounced(eventOrEvents: Event[] | Event) {
    if (eventOrEvents instanceof Array) {
        for (let event of eventOrEvents) {
            if (event.type === "message_sent") {
                expect(event.bounced).toBeFalsy();
            }
        }
    } else if (eventOrEvents.type === "message_sent") {
        expect(eventOrEvents.bounced).toBeFalsy();
    }
}

export function expectBounced(eventOrEvents: Event[] | Event) {
    if (eventOrEvents instanceof Array) {
        let flag = 0;
        for (let event of eventOrEvents) {
            if (event.type === "message_sent") {
                flag += Number(event.bounced);

            }
        }
        expect(flag).toBeTruthy();

    } else if (eventOrEvents.type === "message_sent") {
        expect(eventOrEvents.bounced).toBeTruthy();
    }
}

export function firstCreatedAddress(events: Event[]): Address | null {
    for (let event of events) {
        if (event.type === "account_created") {
            return event.account as Address
        }
    }
    return null
}

export function expectContainsAddress(addressList: Address[], address: Address) {
    let res = false
    for (let addr of addressList) {
        res = addr.toString() === address.toString() ? true : res
    }
    expect(res).toBeTruthy()
}

export function expectNotContainsAddress(addressList: Address[], address: Address) {
    let res = false
    for (let addr of addressList) {
        res = addr.toString() === address.toString() ? true : res
    }
    expect(res).toBeFalsy()
}