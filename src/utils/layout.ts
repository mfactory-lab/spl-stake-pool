import { Layout as LayoutCls, u8 } from 'buffer-layout';
import { Layout } from '@coral-xyz/borsh';
import { Buffer } from 'buffer';

class FutureEpochLayout<T> extends LayoutCls<T | null> {
  layout: Layout<T>;
  discriminator: Layout<number>;

  constructor(layout: Layout<T>, property?: string) {
    super(-1, property);
    this.layout = layout;
    this.discriminator = u8();
  }

  encode(src: T | null, b: Buffer, offset = 0): number {
    if (src === null || src === undefined) {
      return this.discriminator.encode(0, b, offset);
    }
    this.discriminator.encode(1, b, offset);
    return this.layout.encode(src, b, offset + 1) + 1;
  }

  decode(b: Buffer, offset = 0): T | null {
    const discriminator = this.discriminator.decode(b, offset);
    if (discriminator === 0) {
      return null;
    }
    return this.layout.decode(b, offset + 1);
  }

  getSpan(b: Buffer, offset = 0): number {
    const discriminator = this.discriminator.decode(b, offset);
    if (discriminator === 0) {
      return 1;
    }
    return this.layout.getSpan(b, offset + 1) + 1;
  }
}

export function futureEpoch<T>(layout: Layout<T>, property?: string): Layout<T | null> {
  return new FutureEpochLayout<T>(layout, property);
}
