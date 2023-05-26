import * as BufferLayout from '@solana/buffer-layout';

export class OptionLayout<T> extends BufferLayout.Layout<T | undefined> {
  private readonly layout: BufferLayout.Layout<T>;
  private readonly discriminator: BufferLayout.Layout<number>;

  private constructor(layout: BufferLayout.Layout<T>) {
    super(layout.span + 1, layout.property);
    this.layout = layout;
    this.discriminator = BufferLayout.u8();
  }

  public static of<T>(layout: BufferLayout.Layout<T>): OptionLayout<T> {
    return new OptionLayout(layout);
  }

  public encode(src: T, b: Uint8Array, offset?: number): number {
    if (src === null || src === undefined) {
      return this.layout.encode(0 as never as T, b, offset);
    }
    this.discriminator.encode(1, b, offset);
    return this.layout.encode(src, b, (offset ?? 0) + 1) + 1;
  }

  public decode(b: Uint8Array, offset?: number): T | undefined {
    const discriminator = this.discriminator.decode(b, offset);
    if (!discriminator) {
      return undefined;
    }
    return this.layout.decode(b, (offset ?? 0) + 1);
  }
}
