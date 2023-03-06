import * as BufferLayout from '@solana/buffer-layout';
export class OptionLayout extends BufferLayout.Layout {
    constructor(layout) {
        super(layout.span + 1, layout.property);
        this.layout = layout;
        this.discriminator = BufferLayout.u8();
    }
    static of(layout) {
        return new OptionLayout(layout);
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
