/*
 * This file is part of Solana Reference Stake Pool code.
 *
 * Copyright © 2021, mFactory GmbH
 *
 * Solana Reference Stake Pool is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * as published by the Free Software Foundation, either version 3
 * of the License, or (at your option) any later version.
 *
 * Solana Reference Stake Pool is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.
 * If not, see <https://www.gnu.org/licenses/agpl-3.0.html>.
 *
 * You can be released from the requirements of the Affero GNU General Public License
 * by purchasing a commercial license. The purchase of such a license is
 * mandatory as soon as you develop commercial activities using the
 * Solana Reference Stake Pool code without disclosing the source code of
 * your own applications.
 *
 * The developer of this program can be contacted at <info@mfactory.ch>.
 */

/**
 * Based on https://github.com/solana-labs/solana-web3.js/blob/master/src/stake-program.ts
 * https://github.com/solana-labs/solana-program-library/
 */
import { InstructionType } from './copied-from-solana-web3/instruction';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
/**
 * An enumeration of valid StakePoolInstructionType's
 */
export declare type StakePoolInstructionType = 'IncreaseValidatorStake' | 'DecreaseValidatorStake' | 'UpdateValidatorListBalance' | 'UpdateStakePoolBalance' | 'CleanupRemovedValidatorEntries' | 'DepositStake' | 'DepositSol' | 'WithdrawStake' | 'WithdrawSol';
/**
 * An enumeration of valid stake InstructionType's
 * @internal
 */
export declare const STAKE_POOL_INSTRUCTION_LAYOUTS: {
    [type in StakePoolInstructionType]: InstructionType;
};
/**
 * Cleans up validator stake account entries marked as `ReadyForRemoval`
 */
export declare type CleanupRemovedValidatorEntriesParams = {
    stakePool: PublicKey;
    validatorList: PublicKey;
};
/**
 * Updates balances of validator and transient stake accounts in the pool.
 */
export declare type UpdateValidatorListBalanceParams = {
    stakePool: PublicKey;
    withdrawAuthority: PublicKey;
    validatorList: PublicKey;
    reserveStake: PublicKey;
    validatorAndTransientStakePairs: PublicKey[];
    startIndex: number;
    noMerge: boolean;
};
/**
 * Updates total pool balance based on balances in the reserve and validator list.
 */
export declare type UpdateStakePoolBalanceParams = {
    stakePool: PublicKey;
    withdrawAuthority: PublicKey;
    validatorList: PublicKey;
    reserveStake: PublicKey;
    managerFeeAccount: PublicKey;
    poolMint: PublicKey;
};
/**
 * (Staker only) Decrease active stake on a validator, eventually moving it to the reserve
 */
export declare type DecreaseValidatorStakeParams = {
    stakePool: PublicKey;
    staker: PublicKey;
    withdrawAuthority: PublicKey;
    validatorList: PublicKey;
    validatorStake: PublicKey;
    transientStake: PublicKey;
    lamports: number;
    transientStakeSeed: number;
};
/**
 * (Staker only) Increase stake on a validator from the reserve account.
 */
export declare type IncreaseValidatorStakeParams = {
    stakePool: PublicKey;
    staker: PublicKey;
    withdrawAuthority: PublicKey;
    validatorList: PublicKey;
    reserveStake: PublicKey;
    transientStake: PublicKey;
    validatorVote: PublicKey;
    lamports: number;
    transientStakeSeed: number;
};
/**
 * Deposits a stake account into the pool in exchange for pool tokens
 */
export declare type DepositStakeParams = {
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
};
/**
 * Withdraws a stake account from the pool in exchange for pool tokens
 */
export declare type WithdrawStakeParams = {
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
    poolTokens: number;
};
/**
 * Withdraw sol instruction params
 */
export declare type WithdrawSolParams = {
    stakePool: PublicKey;
    sourcePoolAccount: PublicKey;
    withdrawAuthority: PublicKey;
    reserveStake: PublicKey;
    destinationSystemAccount: PublicKey;
    sourceTransferAuthority: PublicKey;
    solWithdrawAuthority?: PublicKey | undefined;
    managerFeeAccount: PublicKey;
    poolMint: PublicKey;
    poolTokens: number;
};
/**
 * Deposit SOL directly into the pool's reserve account. The output is a "pool" token
 * representing ownership into the pool. Inputs are converted to the current ratio.
 */
export declare type DepositSolParams = {
    stakePool: PublicKey;
    depositAuthority?: PublicKey | undefined;
    withdrawAuthority: PublicKey;
    reserveStake: PublicKey;
    fundingAccount: PublicKey;
    destinationPoolAccount: PublicKey;
    managerFeeAccount: PublicKey;
    referralPoolAccount: PublicKey;
    poolMint: PublicKey;
    lamports: number;
};
/**
 * Stake Pool Instruction class
 */
export declare class StakePoolInstruction {
    /**
     * Creates instruction to update a set of validators in the stake pool.
     */
    static updateValidatorListBalance(params: UpdateValidatorListBalanceParams): TransactionInstruction;
    /**
     * Creates instruction to update the overall stake pool balance.
     */
    static updateStakePoolBalance(params: UpdateStakePoolBalanceParams): TransactionInstruction;
    /**
     * Creates instruction to cleanup removed validator entries.
     */
    static cleanupRemovedValidatorEntries(params: CleanupRemovedValidatorEntriesParams): TransactionInstruction;
    /**
     * Creates instruction to increase the stake on a validator.
     */
    static increaseValidatorStake(params: IncreaseValidatorStakeParams): TransactionInstruction;
    /**
     * Creates instruction to decrease the stake on a validator.
     */
    static decreaseValidatorStake(params: DecreaseValidatorStakeParams): TransactionInstruction;
    /**
     * Creates a transaction instruction to deposit SOL into a stake pool.
     */
    static depositStake(params: DepositStakeParams): TransactionInstruction;
    /**
     * Creates a transaction instruction to withdraw SOL from a stake pool.
     */
    static depositSol(params: DepositSolParams): TransactionInstruction;
    /**
     * Creates a transaction instruction to withdraw SOL from a stake pool.
     */
    static withdrawStake(params: WithdrawStakeParams): TransactionInstruction;
    /**
     * Creates a transaction instruction to withdraw SOL from a stake pool.
     */
    static withdrawSol(params: WithdrawSolParams): TransactionInstruction;
    /**
     * Decode a deposit stake pool instruction and retrieve the instruction params.
     */
    static decodeDepositStake(instruction: TransactionInstruction): DepositStakeParams;
    /**
     * Decode a deposit sol instruction and retrieve the instruction params.
     */
    static decodeDepositSol(instruction: TransactionInstruction): DepositSolParams;
    /**
     * @internal
     */
    private static checkProgramId;
    /**
     * @internal
     */
    private static checkKeyLength;
}
