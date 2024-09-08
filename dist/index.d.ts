import type { AccountInfo, Connection, Signer, TransactionInstruction } from '@solana/web3.js';
import { Keypair, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import type { ValidatorAccount } from './utils';
import type { Fee, StakePool, ValidatorList } from './layouts';
import { StakeAccount } from './layouts';
export type { StakePool, AccountType, ValidatorList, ValidatorStakeInfo } from './layouts';
export { STAKE_POOL_PROGRAM_ID } from './constants';
export * from './instructions';
export interface ValidatorListAccount {
    pubkey: PublicKey;
    account: AccountInfo<ValidatorList>;
}
export interface StakePoolAccount {
    pubkey: PublicKey;
    account: AccountInfo<StakePool>;
}
export interface WithdrawAccount {
    stakeAddress: PublicKey;
    voteAddress?: PublicKey;
    poolAmount: BN;
}
/**
 * Wrapper class for a stake pool.
 * Each stake pool has a stake pool account and a validator list account.
 */
export interface StakePoolAccounts {
    stakePool: StakePoolAccount | undefined;
    validatorList: ValidatorListAccount | undefined;
}
/**
 * Retrieves and deserializes a StakePool account using a web3js connection and the stake pool address.
 * @param connection An active web3js connection.
 * @param stakePoolAddress The public key (address) of the stake pool account.
 */
export declare function getStakePoolAccount(connection: Connection, stakePoolAddress: PublicKey): Promise<StakePoolAccount>;
/**
 * Retrieves and deserializes a Stake account using a web3js connection and the stake address.
 * @param connection An active web3js connection.
 * @param stakeAccount The public key (address) of the stake account.
 */
export declare function getStakeAccount(connection: Connection, stakeAccount: PublicKey): Promise<StakeAccount>;
/**
 * Retrieves all StakePool and ValidatorList accounts that are running a particular StakePool program.
 * @param connection An active web3js connection.
 * @param stakePoolProgramAddress The public key (address) of the StakePool program.
 */
export declare function getStakePoolAccounts(connection: Connection, stakePoolProgramAddress: PublicKey): Promise<(StakePoolAccount | ValidatorListAccount)[] | undefined>;
/**
 * Creates instructions required to deposit stake to stake pool.
 */
export declare function depositStake(connection: Connection, stakePoolAddress: PublicKey, authorizedPubkey: PublicKey, validatorVote: PublicKey, depositStake: PublicKey, poolTokenReceiverAccount?: PublicKey): Promise<{
    instructions: TransactionInstruction[];
    signers: Signer[];
}>;
/**
 * Creates instructions required to deposit sol to stake pool.
 */
export declare function depositSol(connection: Connection, stakePoolAddress: PublicKey, from: PublicKey, lamports: number, destinationTokenAccount?: PublicKey, referrerTokenAccount?: PublicKey, depositAuthority?: PublicKey, ephemeralAddress?: PublicKey): Promise<{
    instructions: TransactionInstruction[];
    signers: Signer[];
}>;
/**
 * Creates instructions required to withdraw stake from a stake pool.
 */
export declare function withdrawStake(connection: Connection, stakePoolAddress: PublicKey, tokenOwner: PublicKey, amount: number, useReserve?: boolean, voteAccountAddress?: PublicKey, stakeReceiver?: PublicKey, poolTokenAccount?: PublicKey, validatorComparator?: (_a: ValidatorAccount, _b: ValidatorAccount) => number, ephemeralAddress?: PublicKey): Promise<{
    instructions: TransactionInstruction[];
    signers: Signer[];
    stakeReceiver: PublicKey | undefined;
    totalRentFreeBalances: number;
}>;
/**
 * Creates instructions required to withdraw SOL directly from a stake pool.
 */
export declare function withdrawSol(connection: Connection, stakePoolAddress: PublicKey, tokenOwner: PublicKey, solReceiver: PublicKey, amount: number, solWithdrawAuthority?: PublicKey, ephemeralAddress?: PublicKey): Promise<{
    instructions: TransactionInstruction[];
    signers: Signer[];
}>;
/**
 * Creates instructions required to increase validator stake.
 */
export declare function increaseValidatorStake(connection: Connection, stakePoolAddress: PublicKey, validatorVote: PublicKey, lamports: number, ephemeralStakeSeed?: number): Promise<{
    instructions: TransactionInstruction[];
}>;
/**
 * Creates instructions required to decrease validator stake.
 */
export declare function decreaseValidatorStake(connection: Connection, stakePoolAddress: PublicKey, validatorVote: PublicKey, lamports: number, ephemeralStakeSeed?: number): Promise<{
    instructions: TransactionInstruction[];
}>;
/**
 * Creates instructions required to completely update a stake pool after epoch change.
 */
export declare function updateStakePool(connection: Connection, stakePool: StakePoolAccount, noMerge?: boolean): Promise<{
    updateListInstructions: TransactionInstruction[];
    finalInstructions: TransactionInstruction[];
}>;
/**
 * Retrieves detailed information about the StakePool.
 */
export declare function stakePoolInfo(connection: Connection, stakePoolAddress: PublicKey): Promise<{
    address: string;
    poolWithdrawAuthority: string;
    manager: string;
    staker: string;
    stakeDepositAuthority: string;
    stakeWithdrawBumpSeed: number;
    maxValidators: number;
    validatorList: {
        activeStakeLamports: string;
        transientStakeLamports: string;
        lastUpdateEpoch: string;
        transientSeedSuffixStart: string;
        transientSeedSuffixEnd: string;
        status: string;
        voteAccountAddress: string;
    }[];
    validatorListStorageAccount: string;
    reserveStake: string;
    poolMint: string;
    managerFeeAccount: string;
    tokenProgramId: string;
    totalLamports: string;
    poolTokenSupply: string;
    lastUpdateEpoch: string;
    lockup: import("./layouts").Lockup;
    epochFee: Fee;
    nextEpochFee: Fee | undefined;
    preferredDepositValidatorVoteAddress: PublicKey | undefined;
    preferredWithdrawValidatorVoteAddress: PublicKey | undefined;
    stakeDepositFee: Fee;
    stakeWithdrawalFee: Fee;
    nextStakeWithdrawalFee: Fee | undefined;
    stakeReferralFee: number;
    solDepositAuthority: string | undefined;
    solDepositFee: Fee;
    solReferralFee: number;
    solWithdrawAuthority: string | undefined;
    solWithdrawalFee: Fee;
    nextSolWithdrawalFee: Fee | undefined;
    lastEpochPoolTokenSupply: string;
    lastEpochTotalLamports: string;
    details: {
        reserveStakeLamports: number | undefined;
        reserveAccountStakeAddress: string;
        minimumReserveStakeBalance: number;
        stakeAccounts: {
            voteAccountAddress: string;
            stakeAccountAddress: string;
            validatorActiveStakeLamports: string;
            validatorLastUpdateEpoch: string;
            validatorLamports: string;
            validatorTransientStakeAccountAddress: string;
            validatorTransientStakeLamports: string;
            updateRequired: boolean;
        }[];
        totalLamports: BN;
        totalPoolTokens: number;
        currentNumberOfValidators: number;
        maxNumberOfValidators: number;
        updateRequired: boolean;
    };
}>;
interface RedelegateProps {
    connection: Connection;
    stakePoolAddress: PublicKey;
    sourceVoteAccount: PublicKey;
    destinationVoteAccount: PublicKey;
    ephemeralStakeSeed?: number | BN;
    lamports: number | BN;
}
/**
 * Creates instructions required to redelegate stake.
 */
export declare function redelegate(props: RedelegateProps): Promise<{
    instructions: TransactionInstruction[];
}>;
interface InitializeProps {
    connection: Connection;
    manager: Keypair;
    stakePool?: Keypair;
    validatorList?: Keypair;
    poolMint: PublicKey;
    reserveStake: PublicKey;
    managerPoolAccount: PublicKey;
    fee?: Fee;
    depositFee?: Fee;
    withdrawalFee?: Fee;
    referralFee?: number;
    maxValidators?: number;
}
/**
 * Initializes a new StakePool.
 */
export declare function initialize(props: InitializeProps): Promise<{
    instructions: TransactionInstruction[];
    signers: Signer[];
}>;
interface CreateStakePoolTokenMetadataProps extends UpdateStakePoolTokenMetadataProps {
    payer: PublicKey;
}
/**
 * Creates instructions required to create pool token metadata.
 */
export declare function createPoolTokenMetadata(props: CreateStakePoolTokenMetadataProps): Promise<{
    instructions: TransactionInstruction[];
}>;
interface UpdateStakePoolTokenMetadataProps {
    connection: Connection;
    stakePool: StakePoolAccount | PublicKey;
    tokenMetadata?: PublicKey;
    name: string;
    symbol: string;
    uri: string;
}
/**
 * Creates instructions required to update pool token metadata.
 */
export declare function updatePoolTokenMetadata(props: UpdateStakePoolTokenMetadataProps): Promise<{
    instructions: TransactionInstruction[];
}>;
/**
 * Creates instructions required to add a validator to the pool.
 */
export declare function addValidatorToPool(connection: Connection, stakePoolAddress: PublicKey, validatorVote: PublicKey, seed?: number): Promise<{
    instructions: TransactionInstruction[];
}>;
/**
 * Creates instruction to remove a validator based on their vote account address.
 */
export declare function removeValidatorFromPool(connection: Connection, stakePoolAddress: PublicKey, validatorVote: PublicKey): Promise<{
    instructions: TransactionInstruction[];
}>;
