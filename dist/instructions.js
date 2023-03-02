import { STAKE_CONFIG_ID, SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY, SYSVAR_STAKE_HISTORY_PUBKEY, StakeProgram, SystemProgram, TransactionInstruction, } from '@solana/web3.js';
import * as BufferLayout from '@solana/buffer-layout';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { METADATA_MAX_NAME_LENGTH, METADATA_MAX_SYMBOL_LENGTH, METADATA_MAX_URI_LENGTH, METADATA_PROGRAM_ID, STAKE_POOL_PROGRAM_ID, } from './constants';
import { encodeData } from './utils';
const MOVE_STAKE_LAYOUT = BufferLayout.struct([
    BufferLayout.u8('instruction'),
    BufferLayout.nu64('lamports'),
    BufferLayout.nu64('transientStakeSeed'),
]);
const TOKEN_METADATA_LAYOUT = BufferLayout.struct([
    BufferLayout.u8('instruction'),
    BufferLayout.blob(METADATA_MAX_NAME_LENGTH, 'name'),
    BufferLayout.blob(METADATA_MAX_SYMBOL_LENGTH, 'symbol'),
    BufferLayout.blob(METADATA_MAX_URI_LENGTH, 'uri'),
]);
const feeLayout = (property) => BufferLayout.struct([BufferLayout.nu64('denominator'), BufferLayout.nu64('numerator')], property);
/**
 * An enumeration of valid stake InstructionType's
 * @internal
 */
export const STAKE_POOL_INSTRUCTION_LAYOUTS = Object.freeze({
    /// Initializes a new StakePool.
    Initialize: {
        index: 0,
        layout: BufferLayout.struct([
            BufferLayout.u8('instruction'),
            feeLayout('fee'),
            feeLayout('withdrawalFee'),
            feeLayout('depositFee'),
            feeLayout('referralFee'),
            BufferLayout.u32('maxValidators'),
        ]),
    },
    /// (Staker only) Adds stake account delegated to validator to the pool's list of managed validators.
    AddValidatorToPool: {
        index: 1,
        layout: BufferLayout.struct([
            BufferLayout.u8('instruction'),
            // Optional non-zero u32 seed used for generating the validator stake address
            BufferLayout.u32('seed'),
        ]),
    },
    /// (Staker only) Removes validator from the pool, deactivating its stake
    RemoveValidatorFromPool: {
        index: 2,
        layout: BufferLayout.struct([BufferLayout.u8('instruction')]),
    },
    /// (Staker only) Decrease active stake on a validator, eventually moving it to the reserve
    DecreaseValidatorStake: {
        index: 3,
        layout: MOVE_STAKE_LAYOUT,
    },
    /// (Staker only) Increase stake on a validator from the reserve account
    IncreaseValidatorStake: {
        index: 4,
        layout: MOVE_STAKE_LAYOUT,
    },
    // SetPreferredValidator: {
    //   index: 5,
    //   layout: BufferLayout.struct<any>([
    //     BufferLayout.u8('instruction'),
    //     BufferLayout.u8('validatorType'),
    //     BufferLayout.u64('validatorVoteAddress'), // Option<Pubkey>
    //   ]),
    // },
    UpdateValidatorListBalance: {
        index: 6,
        layout: BufferLayout.struct([
            BufferLayout.u8('instruction'),
            BufferLayout.u32('startIndex'),
            BufferLayout.u8('noMerge'),
        ]),
    },
    UpdateStakePoolBalance: {
        index: 7,
        layout: BufferLayout.struct([BufferLayout.u8('instruction')]),
    },
    CleanupRemovedValidatorEntries: {
        index: 8,
        layout: BufferLayout.struct([BufferLayout.u8('instruction')]),
    },
    DepositStake: {
        index: 9,
        layout: BufferLayout.struct([BufferLayout.u8('instruction')]),
    },
    /// Withdraw the token from the pool at the current ratio.
    WithdrawStake: {
        index: 10,
        layout: BufferLayout.struct([
            BufferLayout.u8('instruction'),
            BufferLayout.nu64('poolTokens'),
        ]),
    },
    // /// (Manager only) Update manager
    // SetManager: {
    //   index: 11,
    //   layout: BufferLayout.struct<any>([BufferLayout.u8('instruction')]),
    // },
    // /// (Manager only) Update fee
    // SetFee: {
    //   index: 12,
    //   layout: BufferLayout.struct<any>([
    //     BufferLayout.u8('instruction'),
    //     // Type of fee to update and value to update it to
    //     BufferLayout.nu64('fee'),
    //   ]),
    // },
    // /// (Manager or staker only) Update staker
    // SetStaker: {
    //   index: 13,
    //   layout: BufferLayout.struct<any>([BufferLayout.u8('instruction')]),
    // },
    /// Deposit SOL directly into the pool's reserve account. The output is a "pool" token
    /// representing ownership into the pool. Inputs are converted to the current ratio.
    DepositSol: {
        index: 14,
        layout: BufferLayout.struct([
            BufferLayout.u8('instruction'),
            BufferLayout.nu64('lamports'),
        ]),
    },
    // /// (Manager only) Update SOL deposit, stake deposit, or SOL withdrawal authority.
    // SetFundingAuthority: {
    //   index: 15,
    // },
    /// Withdraw SOL directly from the pool's reserve account. Fails if the
    /// reserve does not have enough SOL.
    WithdrawSol: {
        index: 16,
        layout: BufferLayout.struct([
            BufferLayout.u8('instruction'),
            BufferLayout.nu64('poolTokens'),
        ]),
    },
    /// Create token metadata for the stake-pool token in the
    /// metaplex-token program
    CreateTokenMetadata: {
        index: 17,
        layout: TOKEN_METADATA_LAYOUT,
    },
    /// Update token metadata for the stake-pool token in the
    /// metaplex-token program
    UpdateTokenMetadata: {
        index: 18,
        layout: TOKEN_METADATA_LAYOUT,
    },
    IncreaseAdditionalValidatorStake: {
        index: 19,
        layout: BufferLayout.struct([
            BufferLayout.u8('instruction'),
            BufferLayout.nu64('lamports'),
            BufferLayout.nu64('transientStakeSeed'),
            BufferLayout.nu64('ephemeralStakeSeed'),
        ]),
    },
    DecreaseAdditionalValidatorStake: {
        index: 20,
        layout: BufferLayout.struct([
            BufferLayout.u8('instruction'),
            BufferLayout.nu64('lamports'),
            BufferLayout.nu64('transientStakeSeed'),
            BufferLayout.nu64('ephemeralStakeSeed'),
        ]),
    },
    Redelegate: {
        index: 21,
        layout: BufferLayout.struct([
            BufferLayout.u8('instruction'),
            /// Amount of lamports to redelegate
            BufferLayout.nu64('lamports'),
            /// Seed used to create source transient stake account
            BufferLayout.nu64('sourceTransientStakeSeed'),
            /// Seed used to create destination ephemeral account.
            BufferLayout.nu64('ephemeralStakeSeed'),
            /// Seed used to create destination transient stake account. If there is
            /// already transient stake, this must match the current seed, otherwise
            /// it can be anything
            BufferLayout.nu64('destinationTransientStakeSeed'),
        ]),
    },
});
/**
 * Stake Pool Instruction class
 */
export class StakePoolInstruction {
    /**
     * Creates an 'initialize' instruction.
     */
    static initialize(params) {
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.Initialize;
        const data = encodeData(type, {
            fee: params.fee,
            withdrawalFee: params.withdrawalFee,
            depositFee: params.depositFee,
            referralFee: params.referralFee,
            maxValidators: params.maxValidators,
        });
        const keys = [
            { pubkey: params.stakePool, isSigner: false, isWritable: true },
            { pubkey: params.manager, isSigner: true, isWritable: false },
            { pubkey: params.staker, isSigner: false, isWritable: false },
            { pubkey: params.stakePoolWithdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: params.validatorList, isSigner: false, isWritable: true },
            { pubkey: params.reserveStake, isSigner: false, isWritable: false },
            { pubkey: params.poolMint, isSigner: false, isWritable: true },
            { pubkey: params.managerPoolAccount, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];
        if (params.depositAuthority) {
            keys.push({ pubkey: params.depositAuthority, isSigner: true, isWritable: false });
        }
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates instruction to add a validator to the pool.
     */
    static addValidatorToPool(params) {
        var _a;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.AddValidatorToPool;
        const data = encodeData(type, { seed: (_a = params.seed) !== null && _a !== void 0 ? _a : 0 });
        const keys = [
            { pubkey: params.stakePool, isSigner: false, isWritable: false },
            { pubkey: params.staker, isSigner: true, isWritable: false },
            { pubkey: params.reserveStake, isSigner: false, isWritable: true },
            { pubkey: params.withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: params.validatorList, isSigner: false, isWritable: true },
            { pubkey: params.validatorStake, isSigner: false, isWritable: true },
            { pubkey: params.validatorVote, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: STAKE_CONFIG_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates instruction to remove a validator from the pool.
     */
    static removeValidatorFromPool(params) {
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.RemoveValidatorFromPool;
        const data = encodeData(type);
        const keys = [
            { pubkey: params.stakePool, isSigner: false, isWritable: false },
            { pubkey: params.staker, isSigner: true, isWritable: false },
            { pubkey: params.withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: params.validatorList, isSigner: false, isWritable: true },
            { pubkey: params.validatorStake, isSigner: false, isWritable: true },
            { pubkey: params.transientStake, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates instruction to update a set of validators in the stake pool.
     */
    static updateValidatorListBalance(params) {
        const { stakePool, withdrawAuthority, validatorList, reserveStake, startIndex, noMerge, validatorAndTransientStakePairs, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.UpdateValidatorListBalance;
        const data = encodeData(type, { startIndex, noMerge: noMerge ? 1 : 0 });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
            ...validatorAndTransientStakePairs.map((pubkey) => ({
                pubkey,
                isSigner: false,
                isWritable: true,
            })),
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates instruction to update the overall stake pool balance.
     */
    static updateStakePoolBalance(params) {
        const { stakePool, withdrawAuthority, validatorList, reserveStake, managerFeeAccount, poolMint, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.UpdateStakePoolBalance;
        const data = encodeData(type);
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: true },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: false },
            { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
            { pubkey: poolMint, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates instruction to clean up removed validator entries.
     */
    static cleanupRemovedValidatorEntries(params) {
        const { stakePool, validatorList } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.CleanupRemovedValidatorEntries;
        const data = encodeData(type);
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates `IncreaseValidatorStake` instruction (rebalance from reserve account to
     * transient account)
     */
    static increaseValidatorStake(params) {
        const { stakePool, staker, withdrawAuthority, validatorList, reserveStake, transientStake, validatorStake, validatorVote, lamports, transientStakeSeed, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.IncreaseValidatorStake;
        const data = encodeData(type, { lamports, transientStakeSeed });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: staker, isSigner: true, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: transientStake, isSigner: false, isWritable: true },
            { pubkey: validatorStake, isSigner: false, isWritable: false },
            { pubkey: validatorVote, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: STAKE_CONFIG_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates `IncreaseAdditionalValidatorStake` instruction (rebalance from reserve account to
     * transient account)
     */
    static increaseAdditionalValidatorStake(params) {
        const { stakePool, staker, withdrawAuthority, validatorList, reserveStake, transientStake, validatorStake, validatorVote, lamports, transientStakeSeed, ephemeralStake, ephemeralStakeSeed, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.IncreaseAdditionalValidatorStake;
        const data = encodeData(type, { lamports, transientStakeSeed, ephemeralStakeSeed });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: staker, isSigner: true, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: ephemeralStake, isSigner: false, isWritable: true },
            { pubkey: transientStake, isSigner: false, isWritable: true },
            { pubkey: validatorStake, isSigner: false, isWritable: false },
            { pubkey: validatorVote, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: STAKE_CONFIG_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates `DecreaseValidatorStake` instruction (rebalance from validator account to
     * transient account)
     */
    static decreaseValidatorStake(params) {
        const { stakePool, staker, withdrawAuthority, validatorList, validatorStake, transientStake, lamports, transientStakeSeed, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.DecreaseValidatorStake;
        const data = encodeData(type, { lamports, transientStakeSeed });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: staker, isSigner: true, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: validatorStake, isSigner: false, isWritable: true },
            { pubkey: transientStake, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates `DecreaseAdditionalValidatorStake` instruction (rebalance from
     * validator account to transient account)
     */
    static decreaseAdditionalValidatorStake(params) {
        const { stakePool, staker, withdrawAuthority, validatorList, validatorStake, transientStake, lamports, transientStakeSeed, ephemeralStakeSeed, ephemeralStake, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.DecreaseAdditionalValidatorStake;
        const data = encodeData(type, { lamports, transientStakeSeed, ephemeralStakeSeed });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: staker, isSigner: true, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: validatorStake, isSigner: false, isWritable: true },
            { pubkey: ephemeralStake, isSigner: false, isWritable: true },
            { pubkey: transientStake, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates a transaction instruction to deposit a stake account into a stake pool.
     */
    static depositStake(params) {
        const { stakePool, validatorList, depositAuthority, withdrawAuthority, depositStake, validatorStake, reserveStake, destinationPoolAccount, managerFeeAccount, referralPoolAccount, poolMint, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.DepositStake;
        const data = encodeData(type);
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: true },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: depositAuthority, isSigner: false, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: depositStake, isSigner: false, isWritable: true },
            { pubkey: validatorStake, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: destinationPoolAccount, isSigner: false, isWritable: true },
            { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
            { pubkey: referralPoolAccount, isSigner: false, isWritable: true },
            { pubkey: poolMint, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates a transaction instruction to deposit SOL into a stake pool.
     */
    static depositSol(params) {
        const { stakePool, withdrawAuthority, depositAuthority, reserveStake, fundingAccount, destinationPoolAccount, managerFeeAccount, referralPoolAccount, poolMint, lamports, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.DepositSol;
        const data = encodeData(type, { lamports });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: true },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: fundingAccount, isSigner: true, isWritable: true },
            { pubkey: destinationPoolAccount, isSigner: false, isWritable: true },
            { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
            { pubkey: referralPoolAccount, isSigner: false, isWritable: true },
            { pubkey: poolMint, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];
        if (depositAuthority) {
            keys.push({
                pubkey: depositAuthority,
                isSigner: true,
                isWritable: false,
            });
        }
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates a transaction instruction to withdraw active stake from a stake pool.
     */
    static withdrawStake(params) {
        const { stakePool, validatorList, withdrawAuthority, validatorStake, destinationStake, destinationStakeAuthority, sourceTransferAuthority, sourcePoolAccount, managerFeeAccount, poolMint, poolTokens, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawStake;
        const data = encodeData(type, { poolTokens });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: true },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorStake, isSigner: false, isWritable: true },
            { pubkey: destinationStake, isSigner: false, isWritable: true },
            { pubkey: destinationStakeAuthority, isSigner: false, isWritable: false },
            { pubkey: sourceTransferAuthority, isSigner: true, isWritable: false },
            { pubkey: sourcePoolAccount, isSigner: false, isWritable: true },
            { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
            { pubkey: poolMint, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates a transaction instruction to withdraw SOL from a stake pool.
     */
    static withdrawSol(params) {
        const { stakePool, withdrawAuthority, sourceTransferAuthority, sourcePoolAccount, reserveStake, destinationSystemAccount, managerFeeAccount, solWithdrawAuthority, poolMint, poolTokens, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawSol;
        const data = encodeData(type, { poolTokens });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: true },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: sourceTransferAuthority, isSigner: true, isWritable: false },
            { pubkey: sourcePoolAccount, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: destinationSystemAccount, isSigner: false, isWritable: true },
            { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
            { pubkey: poolMint, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];
        if (solWithdrawAuthority) {
            keys.push({
                pubkey: solWithdrawAuthority,
                isSigner: true,
                isWritable: false,
            });
        }
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates an instruction to create metadata
     * using the mpl token metadata program for the pool token
     */
    static createTokenMetadata(params) {
        const { stakePool, withdrawAuthority, tokenMetadata, manager, payer, poolMint, name, symbol, uri, } = params;
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: manager, isSigner: true, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: poolMint, isSigner: false, isWritable: false },
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: tokenMetadata, isSigner: false, isWritable: true },
            { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ];
        const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.CreateTokenMetadata, {
            name: new TextEncoder().encode(name.padEnd(METADATA_MAX_NAME_LENGTH, '\0')),
            symbol: new TextEncoder().encode(symbol.padEnd(METADATA_MAX_SYMBOL_LENGTH, '\0')),
            uri: new TextEncoder().encode(uri.padEnd(METADATA_MAX_URI_LENGTH, '\0')),
        });
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates an instruction to update metadata
     * in the mpl token metadata program account for the pool token
     */
    static updateTokenMetadata(params) {
        const { stakePool, withdrawAuthority, tokenMetadata, manager, name, symbol, uri } = params;
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: manager, isSigner: true, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: tokenMetadata, isSigner: false, isWritable: true },
            { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
        ];
        const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.UpdateTokenMetadata, {
            name: new TextEncoder().encode(name.padEnd(METADATA_MAX_NAME_LENGTH, '\0')),
            symbol: new TextEncoder().encode(symbol.padEnd(METADATA_MAX_SYMBOL_LENGTH, '\0')),
            uri: new TextEncoder().encode(uri.padEnd(METADATA_MAX_URI_LENGTH, '\0')),
        });
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates `Redelegate` instruction (rebalance from one validator account to another)
     * @param params
     */
    static redelegate(params) {
        const { stakePool, staker, stakePoolWithdrawAuthority, validatorList, sourceValidatorStake, sourceTransientStake, ephemeralStake, destinationTransientStake, destinationValidatorStake, validator, lamports, sourceTransientStakeSeed, ephemeralStakeSeed, destinationTransientStakeSeed, } = params;
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: staker, isSigner: true, isWritable: false },
            { pubkey: stakePoolWithdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: sourceValidatorStake, isSigner: false, isWritable: true },
            { pubkey: sourceTransientStake, isSigner: false, isWritable: true },
            { pubkey: ephemeralStake, isSigner: false, isWritable: true },
            { pubkey: destinationTransientStake, isSigner: false, isWritable: true },
            { pubkey: destinationValidatorStake, isSigner: false, isWritable: false },
            { pubkey: validator, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: STAKE_CONFIG_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.Redelegate, {
            lamports,
            sourceTransientStakeSeed,
            ephemeralStakeSeed,
            destinationTransientStakeSeed,
        });
        return new TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
}
