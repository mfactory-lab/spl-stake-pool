import type { PublicKey } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import type { InstructionType } from './utils';
import { Fee } from './layouts';
/**
 * An enumeration of valid StakePoolInstructionType's
 */
export type StakePoolInstructionType = 'Initialize' | 'AddValidatorToPool' | 'RemoveValidatorFromPool' | 'DecreaseValidatorStake' | 'IncreaseValidatorStake' | 'SetPreferredValidator' | 'UpdateValidatorListBalance' | 'UpdateStakePoolBalance' | 'CleanupRemovedValidatorEntries' | 'DepositStake' | 'WithdrawStake' | 'SetManager' | 'SetFee' | 'SetStaker' | 'DepositSol' | 'SetFundingAuthority' | 'WithdrawSol' | 'CreateTokenMetadata' | 'UpdateTokenMetadata' | 'IncreaseAdditionalValidatorStake' | 'DecreaseAdditionalValidatorStake' | 'DecreaseValidatorStakeWithReserve' | 'Redelegate' | 'DepositStakeWithSlippage' | 'WithdrawStakeWithSlippage' | 'DepositSolWithSlippage' | 'WithdrawSolWithSlippage';
/**
 * An enumeration of valid stake InstructionType's
 * @internal
 */
export declare const STAKE_POOL_INSTRUCTION_LAYOUTS: {
    [type in StakePoolInstructionType]: InstructionType;
};
export interface InitializeParams {
    stakePool: PublicKey;
    manager: PublicKey;
    staker: PublicKey;
    stakePoolWithdrawAuthority: PublicKey;
    validatorList: PublicKey;
    reserveStake: PublicKey;
    poolMint: PublicKey;
    managerPoolAccount: PublicKey;
    depositAuthority?: PublicKey;
    fee: Fee;
    withdrawalFee: Fee;
    depositFee: Fee;
    referralFee: number;
    maxValidators: number;
}
export interface AddValidatorToPoolParams {
    stakePool: PublicKey;
    staker: PublicKey;
    reserveStake: PublicKey;
    withdrawAuthority: PublicKey;
    validatorList: PublicKey;
    validatorStake: PublicKey;
    validatorVote: PublicKey;
    seed?: number;
}
export interface RemoveValidatorFromPoolParams {
    stakePool: PublicKey;
    staker: PublicKey;
    withdrawAuthority: PublicKey;
    validatorList: PublicKey;
    validatorStake: PublicKey;
    transientStake: PublicKey;
}
/**
 * Cleans up validator stake account entries marked as `ReadyForRemoval`
 */
export interface CleanupRemovedValidatorEntriesParams {
    stakePool: PublicKey;
    validatorList: PublicKey;
}
/**
 * Updates balances of validator and transient stake accounts in the pool.
 */
export interface UpdateValidatorListBalanceParams {
    stakePool: PublicKey;
    withdrawAuthority: PublicKey;
    validatorList: PublicKey;
    reserveStake: PublicKey;
    validatorAndTransientStakePairs: PublicKey[];
    startIndex: number;
    noMerge: boolean;
}
/**
 * Updates total pool balance based on balances in the reserve and validator list.
 */
export interface UpdateStakePoolBalanceParams {
    stakePool: PublicKey;
    withdrawAuthority: PublicKey;
    validatorList: PublicKey;
    reserveStake: PublicKey;
    managerFeeAccount: PublicKey;
    poolMint: PublicKey;
}
/**
 * (Staker only) Decrease active stake on a validator, eventually moving it to the reserve
 */
export interface DecreaseValidatorStakeParams {
    stakePool: PublicKey;
    staker: PublicKey;
    withdrawAuthority: PublicKey;
    validatorList: PublicKey;
    validatorStake: PublicKey;
    transientStake: PublicKey;
    lamports: number | BN;
    transientStakeSeed: number | BN;
}
export interface DecreaseValidatorStakeWithReserveParams extends DecreaseValidatorStakeParams {
    reserveStake: PublicKey;
}
export interface DecreaseAdditionalValidatorStakeParams extends DecreaseValidatorStakeParams {
    ephemeralStake: PublicKey;
    ephemeralStakeSeed: number | BN;
}
/**
 * (Staker only) Increase stake on a validator from the reserve account.
 */
export interface IncreaseValidatorStakeParams {
    stakePool: PublicKey;
    staker: PublicKey;
    withdrawAuthority: PublicKey;
    validatorList: PublicKey;
    reserveStake: PublicKey;
    transientStake: PublicKey;
    validatorStake: PublicKey;
    validatorVote: PublicKey;
    lamports: number | BN;
    transientStakeSeed: number | BN;
}
export interface IncreaseAdditionalValidatorStakeParams extends IncreaseValidatorStakeParams {
    ephemeralStake: PublicKey;
    ephemeralStakeSeed: number | BN;
}
/**
 * Deposits a stake account into the pool in exchange for pool tokens
 */
export interface DepositStakeParams {
    stakePool: PublicKey;
    validatorList: PublicKey;
    depositAuthority: PublicKey;
    withdrawAuthority: PublicKey;
    depositStake: PublicKey;
    validatorStake: PublicKey;
    reserveStake: PublicKey;
    destinationPoolAccount: PublicKey;
    managerFeeAccount: PublicKey;
    referralPoolAccount: PublicKey;
    poolMint: PublicKey;
}
/**
 * Withdraws a stake account from the pool in exchange for pool tokens
 */
export interface WithdrawStakeParams {
    stakePool: PublicKey;
    validatorList: PublicKey;
    withdrawAuthority: PublicKey;
    validatorStake: PublicKey;
    destinationStake: PublicKey;
    destinationStakeAuthority: PublicKey;
    sourceTransferAuthority: PublicKey;
    sourcePoolAccount: PublicKey;
    managerFeeAccount: PublicKey;
    poolMint: PublicKey;
    poolTokens: number | BN;
    minimumLamportsOut?: number | BN | undefined;
}
/**
 * Withdraw sol instruction params
 */
export interface WithdrawSolParams {
    stakePool: PublicKey;
    sourcePoolAccount: PublicKey;
    withdrawAuthority: PublicKey;
    reserveStake: PublicKey;
    destinationSystemAccount: PublicKey;
    sourceTransferAuthority: PublicKey;
    solWithdrawAuthority?: PublicKey | undefined;
    managerFeeAccount: PublicKey;
    poolMint: PublicKey;
    poolTokens: number | BN;
    minimumLamportsOut?: number | BN | undefined;
}
/**
 * Deposit SOL directly into the pool's reserve account. The output is a "pool" token
 * representing ownership into the pool. Inputs are converted to the current ratio.
 */
export interface DepositSolParams {
    stakePool: PublicKey;
    depositAuthority?: PublicKey | undefined;
    withdrawAuthority: PublicKey;
    reserveStake: PublicKey;
    fundingAccount: PublicKey;
    destinationPoolAccount: PublicKey;
    managerFeeAccount: PublicKey;
    referralPoolAccount: PublicKey;
    poolMint: PublicKey;
    lamports: number | BN;
    minimumPoolTokensOut?: number | BN | undefined;
}
export interface UpdateTokenMetadataParams {
    stakePool: PublicKey;
    manager: PublicKey;
    tokenMetadata: PublicKey;
    withdrawAuthority: PublicKey;
    name: string;
    symbol: string;
    uri: string;
}
export interface CreateTokenMetadataParams extends UpdateTokenMetadataParams {
    poolMint: PublicKey;
    payer: PublicKey;
}
export interface RedelegateParams {
    stakePool: PublicKey;
    staker: PublicKey;
    stakePoolWithdrawAuthority: PublicKey;
    validatorList: PublicKey;
    reserveStake: PublicKey;
    sourceValidatorStake: PublicKey;
    sourceTransientStake: PublicKey;
    ephemeralStake: PublicKey;
    destinationTransientStake: PublicKey;
    destinationValidatorStake: PublicKey;
    validator: PublicKey;
    lamports: number | BN;
    sourceTransientStakeSeed: number | BN;
    ephemeralStakeSeed: number | BN;
    destinationTransientStakeSeed: number | BN;
}
export interface SetManagerParams {
    stakePool: PublicKey;
    manager: PublicKey;
    newManager: PublicKey;
    newFeeReceiver: PublicKey;
}
export interface SetFeeParams {
    stakePool: PublicKey;
    manager: PublicKey;
    fee: number | BN;
}
export interface SetStakerParams {
    stakePool: PublicKey;
    setStakerAuthority: PublicKey;
    newStaker: PublicKey;
}
export interface SetFundingAuthorityParams {
    stakePool: PublicKey;
    manager: PublicKey;
    newSolDepositAuthority?: PublicKey | undefined;
    fundingType: number;
}
export interface SetPreferredValidatorParams {
    stakePool: PublicKey;
    staker: PublicKey;
    validatorList: PublicKey;
    validatorVote?: PublicKey | undefined;
    validatorType: number;
}
/**
 * Stake Pool Instruction class
 */
export declare class StakePoolInstruction {
    /**
     * Creates an 'initialize' instruction.
     */
    static initialize(params: InitializeParams): TransactionInstruction;
    /**
     * Creates instruction to add a validator to the pool.
     */
    static addValidatorToPool(params: AddValidatorToPoolParams): TransactionInstruction;
    /**
     * Creates instruction to remove a validator from the pool.
     */
    static removeValidatorFromPool(params: RemoveValidatorFromPoolParams): TransactionInstruction;
    /**
     * Creates instruction to update a set of validators in the stake pool.
     */
    static updateValidatorListBalance(params: UpdateValidatorListBalanceParams): TransactionInstruction;
    /**
     * Creates instruction to update the overall stake pool balance.
     */
    static updateStakePoolBalance(params: UpdateStakePoolBalanceParams): TransactionInstruction;
    /**
     * Creates instruction to clean up removed validator entries.
     */
    static cleanupRemovedValidatorEntries(params: CleanupRemovedValidatorEntriesParams): TransactionInstruction;
    /**
     * Creates `IncreaseValidatorStake` instruction (rebalance from reserve account to
     * transient account)
     */
    static increaseValidatorStake(params: IncreaseValidatorStakeParams): TransactionInstruction;
    /**
     * Creates `IncreaseAdditionalValidatorStake` instruction (rebalance from reserve account to
     * transient account)
     */
    static increaseAdditionalValidatorStake(params: IncreaseAdditionalValidatorStakeParams): TransactionInstruction;
    /**
     * Creates `DecreaseValidatorStake` instruction (rebalance from validator account to
     * transient account)
     */
    static decreaseValidatorStake(params: DecreaseValidatorStakeParams): TransactionInstruction;
    /**
     * Creates `DecreaseValidatorStakeWithReserve` instruction (rebalance from
     * validator account to transient account)
     */
    static decreaseValidatorStakeWithReserve(params: DecreaseValidatorStakeWithReserveParams): TransactionInstruction;
    /**
     * Creates `DecreaseAdditionalValidatorStake` instruction (rebalance from
     * validator account to transient account)
     */
    static decreaseAdditionalValidatorStake(params: DecreaseAdditionalValidatorStakeParams): TransactionInstruction;
    /**
     * Creates a transaction instruction to deposit a stake account into a stake pool.
     */
    static depositStake(params: DepositStakeParams): TransactionInstruction;
    /**
     * Creates a transaction instruction to deposit SOL into a stake pool.
     */
    static depositSol(params: DepositSolParams): TransactionInstruction;
    /**
     * Creates a transaction instruction to withdraw active stake from a stake pool.
     */
    static withdrawStake(params: WithdrawStakeParams): TransactionInstruction;
    /**
     * Creates a transaction instruction to withdraw SOL from a stake pool.
     */
    static withdrawSol(params: WithdrawSolParams): TransactionInstruction;
    /**
     * Creates an instruction to create metadata
     * using the mpl token metadata program for the pool token
     */
    static createTokenMetadata(params: CreateTokenMetadataParams): TransactionInstruction;
    /**
     * Creates an instruction to update metadata
     * in the mpl token metadata program account for the pool token
     */
    static updateTokenMetadata(params: UpdateTokenMetadataParams): TransactionInstruction;
    /**
     * Creates `Redelegate` instruction (rebalance from one validator account to another)
     * @param params
     */
    static redelegate(params: RedelegateParams): TransactionInstruction;
    /**
     * Creates a 'SetManager' instruction.
     * @param params
     */
    static setManager(params: SetManagerParams): TransactionInstruction;
    /**
     * Creates a 'SetFee' instruction.
     * @param params
     */
    static setFee(params: SetFeeParams): TransactionInstruction;
    /**
     * Creates a 'SetStaker' instruction.
     * @param params
     */
    static setStaker(params: SetStakerParams): TransactionInstruction;
    /**
     * Creates a 'SetFundingAuthority' instruction.
     * @param params
     */
    static setFundingAuthority(params: SetFundingAuthorityParams): TransactionInstruction;
    /**
     * Creates a 'SetPreferredValidator' instruction.
     * @param params
     */
    static setPreferredValidator(params: SetPreferredValidatorParams): TransactionInstruction;
}
