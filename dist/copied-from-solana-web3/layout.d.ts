import * as BufferLayout from '@solana/buffer-layout';
/**
 * Layout for a public key
 */
export declare const publicKey: (property?: string) => BufferLayout.Layout<any>;
/**
 * Layout for a 64bit unsigned value
 */
export declare const uint64: (property?: string) => BufferLayout.Layout<any>;
/**
 * Layout for a Rust String type
 */
export declare const rustString: (property?: string) => BufferLayout.Structure<any>;
/**
 * Layout for an Authorized object
 */
export declare const authorized: (property?: string) => BufferLayout.Structure<any>;
/**
 * Layout for a Lockup object
 */
export declare const lockup: (property?: string) => BufferLayout.Structure<any>;
export declare function getAlloc(type: any, fields: any): number;
