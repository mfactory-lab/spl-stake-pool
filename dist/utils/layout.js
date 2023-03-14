import * as BufferLayout from '@solana/buffer-layout';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
export class SignedNumberLayout extends BufferLayout.Layout {
    constructor(span, property) {
        super(span, property);
    }
    decode(b, offset) {
        const start = offset == undefined ? 0 : offset;
        const data = b.slice(start, start + this.span);
        return new BN(data, undefined, 'le').fromTwos(this.span * 8);
    }
    encode(src, b, offset) {
        const start = offset == undefined ? 0 : offset;
        b.set(src.toTwos(this.span * 8).toArray('le'), start);
        return this.span;
    }
}
export const u64 = (property) => {
    return new SignedNumberLayout(8, property);
};
class WrappedLayout extends BufferLayout.Layout {
    constructor(layout, decoder, encoder, property) {
        super(layout.span, property);
        this.layout = layout;
        this.decoder = decoder;
        this.encoder = encoder;
    }
    decode(b, offset) {
        return this.decoder(this.layout.decode(b, offset));
    }
    encode(src, b, offset) {
        return this.layout.encode(this.encoder(src), b, offset);
    }
    getSpan(b, offset) {
        return this.layout.getSpan(b, offset);
    }
}
export function publicKey(property) {
    return new WrappedLayout(BufferLayout.blob(32), (b) => new PublicKey(b), (key) => key.toBuffer(), property);
}
export function vec(elementLayout, property) {
    const length = BufferLayout.u32('length');
    const layout = BufferLayout.struct([
        length,
        BufferLayout.seq(elementLayout, BufferLayout.offset(length, -length.span), 'values'),
    ]);
    return new WrappedLayout(layout, ({ values }) => values, (values) => ({ values }), property);
}
export class OptionLayout extends BufferLayout.Layout {
    constructor(layout) {
        super(layout.span + 1, layout.property);
        this.layout = layout;
        this.discriminator = BufferLayout.u8();
    }
    encode(src, b, offset) {
        if (src === null || src === undefined) {
            return this.layout.encode(0, b, offset);
        }
        this.discriminator.encode(1, b, offset);
        return this.layout.encode(src, b, (offset !== null && offset !== void 0 ? offset : 0) + 1) + 1;
    }
    decode(b, offset) {
        const discriminator = this.discriminator.decode(b, offset);
        if (!discriminator) {
            return undefined;
        }
        return this.layout.decode(b, (offset !== null && offset !== void 0 ? offset : 0) + 1);
    }
}
export function option(layout) {
    return new OptionLayout(layout);
}
