import * as BufferLayout from '@solana/buffer-layout';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
export declare class SignedNumberLayout extends BufferLayout.Layout<BN> {
    constructor(span: number, property?: string);
    decode(b: Uint8Array, offset?: number): BN;
    encode(src: BN, b: Uint8Array, offset?: number): number;
}
export declare const u64: (property?: string | undefined) => BufferLayout.Layout<BN>;
export declare function publicKey(property?: string): BufferLayout.Layout<PublicKey>;
export declare function vec<T>(elementLayout: BufferLayout.Layout<T>, property?: string): BufferLayout.Layout<T[]>;
export declare class OptionLayout<T> extends BufferLayout.Layout<T | undefined> {
    private readonly layout;
    private readonly discriminator;
    constructor(layout: BufferLayout.Layout<T>);
    encode(src: T, b: Uint8Array, offset?: number): number;
    decode(b: Uint8Array, offset?: number): T | undefined;
}
export declare function option<T>(layout: BufferLayout.Layout<T>): OptionLayout<T>;
