import * as BufferLayout from '@solana/buffer-layout';
export declare class OptionLayout<T> extends BufferLayout.Layout<T | undefined> {
    private readonly layout;
    private readonly discriminator;
    private constructor();
    static of<T>(layout: BufferLayout.Layout<T>): OptionLayout<T>;
    encode(src: T, b: Uint8Array, offset?: number): number;
    decode(b: Uint8Array, offset?: number): T | undefined;
}
