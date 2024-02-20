import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { Buffer } from 'buffer';
import {
  EPHEMERAL_STAKE_SEED_PREFIX,
  METADATA_PROGRAM_ID,
  TRANSIENT_STAKE_SEED_PREFIX,
} from '../constants';

/**
 * Generates the withdraw authority program address for the stake pool
 */
export function findWithdrawAuthorityProgramAddress(
  programId: PublicKey,
  stakePoolAddress: PublicKey,
) {
  const [publicKey] = PublicKey.findProgramAddressSync(
    [stakePoolAddress.toBuffer(), Buffer.from('withdraw')],
    programId,
  );
  return publicKey;
}

/**
 * Generates the stake program address for a validator's vote account
 */
export function findStakeProgramAddress(
  programId: PublicKey,
  voteAccountAddress: PublicKey,
  stakePoolAddress: PublicKey,
) {
  const [publicKey] = PublicKey.findProgramAddressSync(
    [voteAccountAddress.toBuffer(), stakePoolAddress.toBuffer()],
    programId,
  );
  return publicKey;
}

/**
 * Generates the stake program address for a validator's vote account
 */
export function findTransientStakeProgramAddress(
  programId: PublicKey,
  voteAccountAddress: PublicKey,
  stakePoolAddress: PublicKey,
  seed: BN,
) {
  const [publicKey] = PublicKey.findProgramAddressSync(
    [
      TRANSIENT_STAKE_SEED_PREFIX,
      voteAccountAddress.toBuffer(),
      stakePoolAddress.toBuffer(),
      seed.toArrayLike(Buffer, 'le', 8),
    ],
    programId,
  );
  return publicKey;
}

/**
 * Generates the ephemeral program address for stake pool re-delegation
 */
export function findEphemeralStakeProgramAddress(
  programId: PublicKey,
  stakePoolAddress: PublicKey,
  seed: BN,
) {
  const [publicKey] = PublicKey.findProgramAddressSync(
    [EPHEMERAL_STAKE_SEED_PREFIX, stakePoolAddress.toBuffer(), seed.toArrayLike(Buffer, 'le', 8)],
    programId,
  );
  return publicKey;
}

/**
 * Generates the token metadata address by {@link mint}
 */
export function findMetadataAddress(mint: PublicKey): PublicKey {
  const [publicKey] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID,
  );
  return publicKey;
}
