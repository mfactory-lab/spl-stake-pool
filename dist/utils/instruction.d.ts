/// <reference types="node" />
import { Buffer } from 'buffer';
import type { Layout } from '@coral-xyz/borsh';
/**
 * @internal
 */
export type InstructionType<T = any> = {
    /** The Instruction index (from solana upstream program) */
    index: number;
    /** The BufferLayout to use to build data */
    layout: Layout<T>;
};
/**
 * Populate a buffer of instruction data using an InstructionType
 * @internal
 */
export declare function encodeData<T = any>(type: InstructionType<T>, fields?: any): Buffer;
/**
 * Decode instruction data buffer using an InstructionType
 * @internal
 */
export declare function decodeData(type: InstructionType, buffer: Buffer): any;
