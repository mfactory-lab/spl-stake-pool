import type { PublicKey } from '@solana/web3.js';
import {
  STAKE_CONFIG_ID,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_STAKE_HISTORY_PUBKEY,
  StakeProgram,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { option, publicKey, str, struct, u32, u64, u8 } from '@coral-xyz/borsh';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
import {
  METADATA_MAX_NAME_LENGTH,
  METADATA_MAX_SYMBOL_LENGTH,
  METADATA_MAX_URI_LENGTH,
  METADATA_PROGRAM_ID,
  STAKE_POOL_PROGRAM_ID,
} from './constants';
import type { InstructionType } from './utils';
import { encodeData } from './utils';
import { Fee } from './layouts';

/**
 * An enumeration of valid StakePoolInstructionType's
 */
export type StakePoolInstructionType =
  | 'Initialize'
  | 'AddValidatorToPool'
  | 'RemoveValidatorFromPool'
  | 'DecreaseValidatorStake'
  | 'IncreaseValidatorStake'
  | 'SetPreferredValidator'
  | 'UpdateValidatorListBalance'
  | 'UpdateStakePoolBalance'
  | 'CleanupRemovedValidatorEntries'
  | 'DepositStake'
  | 'WithdrawStake'
  | 'SetManager'
  | 'SetFee'
  | 'SetStaker'
  | 'DepositSol'
  | 'SetFundingAuthority'
  | 'WithdrawSol'
  | 'CreateTokenMetadata'
  | 'UpdateTokenMetadata'
  | 'IncreaseAdditionalValidatorStake'
  | 'DecreaseAdditionalValidatorStake'
  | 'DecreaseValidatorStakeWithReserve'
  | 'Redelegate'
  | 'DepositStakeWithSlippage'
  | 'WithdrawStakeWithSlippage'
  | 'DepositSolWithSlippage'
  | 'WithdrawSolWithSlippage';

const MOVE_STAKE_LAYOUT = struct([u8('instruction'), u64('lamports'), u64('transientStakeSeed')]);

const TOKEN_METADATA_LAYOUT = struct([
  u8('instruction'),
  u32('nameLen'),
  str('name'),
  u32('symbolLen'),
  str('symbol'),
  u32('uriLen'),
  str('uri'),
]);

function feeLayout(property?: string) {
  return struct([u64('denominator'), u64('numerator')], property);
}

function validateMetadata(name: string, symbol: string, uri: string) {
  if (name.length > METADATA_MAX_NAME_LENGTH) {
    throw new Error(`maximum token name length is ${METADATA_MAX_NAME_LENGTH} characters`);
  }

  if (symbol.length > METADATA_MAX_SYMBOL_LENGTH) {
    throw new Error(`maximum token symbol length is ${METADATA_MAX_SYMBOL_LENGTH} characters`);
  }

  if (uri.length > METADATA_MAX_URI_LENGTH) {
    throw new Error(`maximum token uri length is ${METADATA_MAX_URI_LENGTH} characters`);
  }
}

/**
 * An enumeration of valid stake InstructionType's
 * @internal
 */
export const STAKE_POOL_INSTRUCTION_LAYOUTS: {
  [type in StakePoolInstructionType]: InstructionType;
} = Object.freeze({
  /// Initializes a new StakePool.
  Initialize: {
    index: 0,
    layout: struct([
      u8('instruction'),
      feeLayout('fee'),
      feeLayout('withdrawalFee'),
      feeLayout('depositFee'),
      u8('referralFee'),
      u32('maxValidators'),
    ]),
  },
  /// (Staker only) Adds stake account delegated to validator to the pool's list of managed validators.
  AddValidatorToPool: {
    index: 1,
    layout: struct([
      u8('instruction'),
      // Optional non-zero u32 seed used for generating the validator stake address
      u32('seed'),
    ]),
  },
  /// (Staker only) Removes validator from the pool, deactivating its stake.
  RemoveValidatorFromPool: {
    index: 2,
    layout: struct([u8('instruction')]),
  },
  /// (Staker only) Decrease active stake on a validator, eventually moving it to the reserve.
  DecreaseValidatorStake: {
    index: 3,
    layout: MOVE_STAKE_LAYOUT,
  },
  /// (Staker only) Increase stake on a validator from the reserve account.
  IncreaseValidatorStake: {
    index: 4,
    layout: MOVE_STAKE_LAYOUT,
  },
  /// (Staker only) Set the preferred deposit or withdraw stake account for the stake pool.
  SetPreferredValidator: {
    index: 5,
    layout: struct([
      u8('instruction'),
      u8('validatorType'),
      option(publicKey(), 'validatorVoteAddress'),
    ]),
  },
  /// Updates balances of validator and transient stake accounts in the pool.
  UpdateValidatorListBalance: {
    index: 6,
    layout: struct([u8('instruction'), u32('startIndex'), u8('noMerge')]),
  },
  /// Updates total pool balance based on balances in the reserve and validator list.
  UpdateStakePoolBalance: {
    index: 7,
    layout: struct([u8('instruction')]),
  },
  /// Cleans up validator stake account entries marked as `ReadyForRemoval`.
  CleanupRemovedValidatorEntries: {
    index: 8,
    layout: struct([u8('instruction')]),
  },
  /// Deposit some stake into the pool. The output is a "pool" token
  /// representing ownership into the pool. Inputs are converted to the
  /// current ratio.
  DepositStake: {
    index: 9,
    layout: struct([u8('instruction')]),
  },
  /// Withdraw the token from the pool at the current ratio.
  WithdrawStake: {
    index: 10,
    layout: struct([u8('instruction'), u64('poolTokens')]),
  },
  /// (Manager only) Update manager.
  SetManager: {
    index: 11,
    layout: struct([u8('instruction')]),
  },
  /// (Manager only) Update fee.
  SetFee: {
    index: 12,
    layout: struct([
      u8('instruction'),
      // Type of fee to update and value to update it to
      u64('fee'),
    ]),
  },
  /// (Manager or staker only) Update staker.
  SetStaker: {
    index: 13,
    layout: struct([u8('instruction')]),
  },
  /// Deposit SOL directly into the pool's reserve account. The output is a "pool" token
  /// representing ownership into the pool. Inputs are converted to the current ratio.
  DepositSol: {
    index: 14,
    layout: struct([u8('instruction'), u64('lamports')]),
  },
  /// (Manager only) Update SOL deposit, stake deposit, or SOL withdrawal authority.
  SetFundingAuthority: {
    index: 15,
    layout: struct([u8('instruction'), u8('fundingType')]),
  },
  /// Withdraw SOL directly from the pool's reserve account. Fails if the
  /// reserve does not have enough SOL.
  WithdrawSol: {
    index: 16,
    layout: struct([u8('instruction'), u64('poolTokens')]),
  },
  /// Create token metadata for the stake-pool token in the
  /// metaplex-token program.
  CreateTokenMetadata: {
    index: 17,
    layout: TOKEN_METADATA_LAYOUT,
  },
  /// Update token metadata for the stake-pool token in the
  /// metaplex-token program.
  UpdateTokenMetadata: {
    index: 18,
    layout: TOKEN_METADATA_LAYOUT,
  },
  /// (Staker only) Increase stake on a validator again in an epoch.
  IncreaseAdditionalValidatorStake: {
    index: 19,
    layout: struct<any>([
      u8('instruction'),
      u64('lamports'),
      u64('transientStakeSeed'),
      u64('ephemeralStakeSeed'),
    ]),
  },
  /// (Staker only) Decrease active stake again from a validator, eventually
  /// moving it to the reserve.
  DecreaseAdditionalValidatorStake: {
    index: 20,
    layout: struct<any>([
      u8('instruction'),
      u64('lamports'),
      u64('transientStakeSeed'),
      u64('ephemeralStakeSeed'),
    ]),
  },
  /// (Staker only) Decrease active stake on a validator, eventually moving it
  /// to the reserve.
  DecreaseValidatorStakeWithReserve: {
    index: 21,
    layout: MOVE_STAKE_LAYOUT,
  },
  /// (Staker only) Redelegate active stake on a validator, eventually moving
  /// it to another.
  Redelegate: {
    index: 22,
    layout: struct([
      u8('instruction'),
      /// Amount of lamports to redelegate
      u64('lamports'),
      /// Seed used to create source transient stake account
      u64('sourceTransientStakeSeed'),
      /// Seed used to create destination ephemeral account.
      u64('ephemeralStakeSeed'),
      /// Seed used to create destination transient stake account. If there is
      /// already transient stake, this must match the current seed, otherwise
      /// it can be anything
      u64('destinationTransientStakeSeed'),
    ]),
  },
  /// Deposit some stake into the pool, with a specified slippage
  /// constraint. The output is a "pool" token representing ownership
  /// into the pool. Inputs are converted at the current ratio.
  DepositStakeWithSlippage: {
    index: 23,
    layout: struct([
      u8('instruction'),
      /// Minimum amount of pool tokens that must be received
      u64('minimumPoolTokensOut'),
    ]),
  },
  /// Withdraw the token from the pool at the current ratio, specifying a
  /// minimum expected output lamport amount.
  WithdrawStakeWithSlippage: {
    index: 24,
    layout: struct([
      u8('instruction'),
      /// Pool tokens to burn in exchange for lamports
      u64('poolTokensIn'),
      /// Minimum amount of lamports that must be received
      u64('minimumLamportsOut'),
    ]),
  },
  /// Deposit SOL directly into the pool's reserve account, with a
  /// specified slippage constraint. The output is a "pool" token
  /// representing ownership into the pool. Inputs are converted at the
  /// current ratio.
  DepositSolWithSlippage: {
    index: 25,
    layout: struct([
      u8('instruction'),
      /// Amount of lamports to deposit into the reserve
      u64('lamportsIn'),
      /// Minimum amount of pool tokens that must be received
      u64('minimumPoolTokensOut'),
    ]),
  },
  /// Withdraw SOL directly from the pool's reserve account. Fails if the
  /// reserve does not have enough SOL or if the slippage constraint is not
  /// met.
  WithdrawSolWithSlippage: {
    index: 26,
    layout: struct([
      u8('instruction'),
      /// Pool tokens to burn in exchange for lamports
      u64('poolTokensIn'),
      /// Minimum amount of lamports that must be received
      u64('minimumLamportsOut'),
    ]),
  },
});

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
  /// (Optional) Seed to used to create the validator stake account.
  seed?: number;
}

export interface RemoveValidatorFromPoolParams {
  stakePool: PublicKey;
  staker: PublicKey;
  withdrawAuthority: PublicKey;
  newStakeAuthority: PublicKey;
  validatorList: PublicKey;
  validatorStake: PublicKey;
  transientStake: PublicKey;
  destinationStake: PublicKey;
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
  // Amount of lamports to split into the transient stake account
  lamports: number | BN;
  // Seed to used to create the transient stake account
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
  // Amount of lamports to split into the transient stake account
  lamports: number | BN;
  // Seed to used to create the transient stake account
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
  // Amount of lamports to redelegate
  lamports: number | BN;
  // Seed used to create source transient stake account
  sourceTransientStakeSeed: number | BN;
  // Seed used to create destination ephemeral account
  ephemeralStakeSeed: number | BN;
  // Seed used to create destination transient stake account. If there is
  // already transient stake, this must match the current seed, otherwise
  // it can be anything
  destinationTransientStakeSeed: number | BN;
}

/**
 * Stake Pool Instruction class
 */
export class StakePoolInstruction {
  /**
   * Creates an 'initialize' instruction.
   */
  static initialize(params: InitializeParams) {
    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.Initialize, {
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
  static addValidatorToPool(params: AddValidatorToPoolParams) {
    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.AddValidatorToPool, {
      seed: params.seed,
    });

    const keys = [
      { pubkey: params.stakePool, isSigner: false, isWritable: true },
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
  static removeValidatorFromPool(params: RemoveValidatorFromPoolParams) {
    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.RemoveValidatorFromPool);

    const keys = [
      { pubkey: params.stakePool, isSigner: false, isWritable: true },
      { pubkey: params.staker, isSigner: true, isWritable: false },
      { pubkey: params.withdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: params.newStakeAuthority, isSigner: false, isWritable: true },
      { pubkey: params.validatorList, isSigner: false, isWritable: true },
      { pubkey: params.validatorStake, isSigner: false, isWritable: true },
      { pubkey: params.transientStake, isSigner: false, isWritable: false },
      { pubkey: params.destinationStake, isSigner: false, isWritable: true },
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
  static updateValidatorListBalance(
    params: UpdateValidatorListBalanceParams,
  ): TransactionInstruction {
    const {
      stakePool,
      withdrawAuthority,
      validatorList,
      reserveStake,
      startIndex,
      noMerge,
      validatorAndTransientStakePairs,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.UpdateValidatorListBalance, {
      startIndex,
      noMerge: noMerge ? 1 : 0,
    });

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
  static updateStakePoolBalance(params: UpdateStakePoolBalanceParams): TransactionInstruction {
    const {
      stakePool,
      withdrawAuthority,
      validatorList,
      reserveStake,
      managerFeeAccount,
      poolMint,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.UpdateStakePoolBalance);

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
  static cleanupRemovedValidatorEntries(
    params: CleanupRemovedValidatorEntriesParams,
  ): TransactionInstruction {
    const { stakePool, validatorList } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.CleanupRemovedValidatorEntries);

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
  static increaseValidatorStake(params: IncreaseValidatorStakeParams): TransactionInstruction {
    const {
      stakePool,
      staker,
      withdrawAuthority,
      validatorList,
      reserveStake,
      transientStake,
      validatorStake,
      validatorVote,
      lamports,
      transientStakeSeed,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.IncreaseValidatorStake, {
      lamports: new BN(lamports),
      transientStakeSeed: new BN(transientStakeSeed),
    });

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
  static increaseAdditionalValidatorStake(
    params: IncreaseAdditionalValidatorStakeParams,
  ): TransactionInstruction {
    const {
      stakePool,
      staker,
      withdrawAuthority,
      validatorList,
      reserveStake,
      transientStake,
      validatorStake,
      validatorVote,
      lamports,
      transientStakeSeed,
      ephemeralStake,
      ephemeralStakeSeed,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.IncreaseAdditionalValidatorStake, {
      lamports: new BN(lamports),
      transientStakeSeed: new BN(transientStakeSeed),
      ephemeralStakeSeed: new BN(ephemeralStakeSeed),
    });

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
  static decreaseValidatorStake(params: DecreaseValidatorStakeParams): TransactionInstruction {
    const {
      stakePool,
      staker,
      withdrawAuthority,
      validatorList,
      validatorStake,
      transientStake,
      lamports,
      transientStakeSeed,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.DecreaseValidatorStake, {
      lamports: new BN(lamports),
      transientStakeSeed: new BN(transientStakeSeed),
    });

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
   * Creates `DecreaseValidatorStakeWithReserve` instruction (rebalance from
   * validator account to transient account)
   */
  static decreaseValidatorStakeWithReserve(
    params: DecreaseValidatorStakeWithReserveParams,
  ): TransactionInstruction {
    const {
      stakePool,
      staker,
      withdrawAuthority,
      validatorList,
      reserveStake,
      validatorStake,
      transientStake,
      lamports,
      transientStakeSeed,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.DecreaseValidatorStakeWithReserve, {
      lamports: new BN(lamports),
      transientStakeSeed: new BN(transientStakeSeed),
    });

    const keys = [
      { pubkey: stakePool, isSigner: false, isWritable: false },
      { pubkey: staker, isSigner: true, isWritable: false },
      { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: validatorList, isSigner: false, isWritable: true },
      { pubkey: reserveStake, isSigner: false, isWritable: true },
      { pubkey: validatorStake, isSigner: false, isWritable: true },
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
   * Creates `DecreaseAdditionalValidatorStake` instruction (rebalance from
   * validator account to transient account)
   */
  static decreaseAdditionalValidatorStake(
    params: DecreaseAdditionalValidatorStakeParams,
  ): TransactionInstruction {
    const {
      stakePool,
      staker,
      withdrawAuthority,
      validatorList,
      validatorStake,
      transientStake,
      lamports,
      transientStakeSeed,
      ephemeralStakeSeed,
      ephemeralStake,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.DecreaseAdditionalValidatorStake, {
      lamports: new BN(lamports),
      transientStakeSeed: new BN(transientStakeSeed),
      ephemeralStakeSeed: new BN(ephemeralStakeSeed),
    });

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
  static depositStake(params: DepositStakeParams): TransactionInstruction {
    const {
      stakePool,
      validatorList,
      depositAuthority,
      withdrawAuthority,
      depositStake,
      validatorStake,
      reserveStake,
      destinationPoolAccount,
      managerFeeAccount,
      referralPoolAccount,
      poolMint,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.DepositStake);

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
  static depositSol(params: DepositSolParams): TransactionInstruction {
    const {
      stakePool,
      withdrawAuthority,
      depositAuthority,
      reserveStake,
      fundingAccount,
      destinationPoolAccount,
      managerFeeAccount,
      referralPoolAccount,
      poolMint,
      lamports,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.DepositSol, {
      lamports: new BN(lamports),
    });

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
  static withdrawStake(params: WithdrawStakeParams): TransactionInstruction {
    const {
      stakePool,
      validatorList,
      withdrawAuthority,
      validatorStake,
      destinationStake,
      destinationStakeAuthority,
      sourceTransferAuthority,
      sourcePoolAccount,
      managerFeeAccount,
      poolMint,
      poolTokens,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawStake, {
      poolTokens: new BN(poolTokens),
    });

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
  static withdrawSol(params: WithdrawSolParams): TransactionInstruction {
    const {
      stakePool,
      withdrawAuthority,
      sourceTransferAuthority,
      sourcePoolAccount,
      reserveStake,
      destinationSystemAccount,
      managerFeeAccount,
      solWithdrawAuthority,
      poolMint,
      poolTokens,
    } = params;

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawSol, {
      poolTokens: new BN(poolTokens),
    });

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
  static createTokenMetadata(params: CreateTokenMetadataParams): TransactionInstruction {
    const {
      stakePool,
      withdrawAuthority,
      tokenMetadata,
      manager,
      payer,
      poolMint,
      name,
      symbol,
      uri,
    } = params;

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

    validateMetadata(name, symbol, uri);

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.CreateTokenMetadata, {
      nameLen: name.length,
      name: Buffer.from(name.padEnd(METADATA_MAX_NAME_LENGTH, '\0')),
      symbolLen: symbol.length,
      symbol: Buffer.from(symbol.padEnd(METADATA_MAX_SYMBOL_LENGTH, '\0')),
      uriLen: uri.length,
      uri: Buffer.from(uri.padEnd(METADATA_MAX_URI_LENGTH, '\0')),
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
  static updateTokenMetadata(params: UpdateTokenMetadataParams): TransactionInstruction {
    const { stakePool, withdrawAuthority, tokenMetadata, manager, name, symbol, uri } = params;

    const keys = [
      { pubkey: stakePool, isSigner: false, isWritable: false },
      { pubkey: manager, isSigner: true, isWritable: false },
      { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: tokenMetadata, isSigner: false, isWritable: true },
      { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    validateMetadata(name, symbol, uri);

    const data = encodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.UpdateTokenMetadata, {
      nameLen: name.length,
      name: Buffer.from(name.padEnd(METADATA_MAX_NAME_LENGTH, '\0')),
      symbolLen: symbol.length,
      symbol: Buffer.from(symbol.padEnd(METADATA_MAX_SYMBOL_LENGTH, '\0')),
      uriLen: uri.length,
      uri: Buffer.from(uri.padEnd(METADATA_MAX_URI_LENGTH, '\0')),
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
  static redelegate(params: RedelegateParams): TransactionInstruction {
    const {
      stakePool,
      staker,
      stakePoolWithdrawAuthority,
      validatorList,
      reserveStake,
      sourceValidatorStake,
      sourceTransientStake,
      ephemeralStake,
      destinationTransientStake,
      destinationValidatorStake,
      validator,
      lamports,
      sourceTransientStakeSeed,
      ephemeralStakeSeed,
      destinationTransientStakeSeed,
    } = params;

    const keys = [
      { pubkey: stakePool, isSigner: false, isWritable: false },
      { pubkey: staker, isSigner: true, isWritable: false },
      { pubkey: stakePoolWithdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: validatorList, isSigner: false, isWritable: true },
      { pubkey: reserveStake, isSigner: false, isWritable: true },
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
      lamports: new BN(lamports),
      sourceTransientStakeSeed: new BN(sourceTransientStakeSeed),
      ephemeralStakeSeed: new BN(ephemeralStakeSeed),
      destinationTransientStakeSeed: new BN(destinationTransientStakeSeed),
    });

    return new TransactionInstruction({
      programId: STAKE_POOL_PROGRAM_ID,
      keys,
      data,
    });
  }
}
