/// <reference types="node" />
import { Buffer } from 'buffer';
import { PublicKey } from '@solana/web3.js';
export declare const STAKE_POOL_PROGRAM_ID: PublicKey;
export declare const MAX_VALIDATORS_TO_UPDATE = 5;
export declare const TRANSIENT_STAKE_SEED_PREFIX: Buffer;
export declare const MINIMUM_ACTIVE_STAKE = 1000000000;
export declare const MINIMUM_RESERVE_LAMPORTS = 1000000000;
