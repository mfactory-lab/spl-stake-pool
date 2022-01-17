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

import {
  Connection,
  Keypair,
  PublicKey, StakeProgram,
  SystemProgram,
  TransactionInstruction
} from "@solana/web3.js";
import { findStakeProgramAddress, findTransientStakeProgramAddress } from "./program-address";
import BN from "bn.js";

import { lamportsToSol } from "./math";
import { WithdrawAccount } from "../index";
import {
  StakePool,
  ValidatorList,
  ValidatorListLayout,
  ValidatorStakeInfoStatus
} from "../layouts";
import { STAKE_POOL_PROGRAM_ID } from "../constants";

export async function getValidatorListAccount(
  connection: Connection,
  pubkey: PublicKey,
) {
  const account = await connection.getAccountInfo(pubkey);
  if (!account) {
    throw new Error('Invalid validator list account');
  }
  return {
    pubkey,
    account: {
      data: ValidatorListLayout.decode(account!.data) as ValidatorList,
      executable: account.executable,
      lamports: account.lamports,
      owner: account.owner,
    },
  };
}

export interface ValidatorAccount {
  type: 'preferred' | 'active' | 'transient' | 'reserve';
  voteAddress?: PublicKey | undefined;
  stakeAddress: PublicKey;
  lamports: number;
}

export async function prepareWithdrawAccounts(
  connection: Connection,
  stakePool: StakePool,
  stakePoolAddress: PublicKey,
  amount: number,
  compareFn?: (a: ValidatorAccount, b: ValidatorAccount) => number
): Promise<WithdrawAccount[]> {
  const validatorListAcc = await connection.getAccountInfo(stakePool.validatorList);
  const validatorList = ValidatorListLayout.decode(validatorListAcc!.data) as ValidatorList;

  if (!validatorList?.validators || validatorList?.validators.length == 0) {
    throw new Error('No accounts found');
  }

  let accounts = [] as Array<{
    type: 'preferred' | 'active' | 'transient' | 'reserve';
    voteAddress?: PublicKey | undefined;
    stakeAddress: PublicKey;
    lamports: number;
  }>;

  // Prepare accounts
  for (const validator of validatorList.validators) {

    if (validator.status !== ValidatorStakeInfoStatus.Active) {
      continue;
    }

    const stakeAccountAddress = await findStakeProgramAddress(
      STAKE_POOL_PROGRAM_ID,
      validator.voteAccountAddress,
      stakePoolAddress,
    );

    if (!validator.activeStakeLamports.isZero()) {
      const isPreferred =
        stakePool.preferredWithdrawValidatorVoteAddress &&
        stakePool.preferredWithdrawValidatorVoteAddress!.toBase58() ==
        validator.voteAccountAddress.toBase58();
      accounts.push({
        type: isPreferred ? 'preferred' : 'active',
        voteAddress: validator.voteAccountAddress,
        stakeAddress: stakeAccountAddress,
        lamports: validator.activeStakeLamports.toNumber(),
      });
    }

    const transientStakeAccountAddress = await findTransientStakeProgramAddress(
      STAKE_POOL_PROGRAM_ID,
      validator.voteAccountAddress,
      stakePoolAddress,
      validator.transientSeedSuffixStart!,
    );

    if (!validator.transientStakeLamports?.isZero()) {
      accounts.push({
        type: 'transient',
        voteAddress: validator.voteAccountAddress,
        stakeAddress: transientStakeAccountAddress,
        lamports: validator.transientStakeLamports!.toNumber(),
      });
    }
  }

  // Sort from highest to lowest balance
  accounts = accounts.sort(compareFn ? compareFn : (a, b) => b.lamports - a.lamports);

  const reserveStake = await connection.getAccountInfo(stakePool.reserveStake);
  if (reserveStake && reserveStake.lamports > 0) {
    console.log('Reserve Stake: ', reserveStake.lamports);
    accounts.push({
      type: 'reserve',
      stakeAddress: stakePool.reserveStake,
      lamports: reserveStake?.lamports,
    });
  }

  // Prepare the list of accounts to withdraw from
  const withdrawFrom: WithdrawAccount[] = [];
  let remainingAmount = amount;

  for (const type of ['preferred', 'active', 'transient', 'reserve']) {
    const filteredAccounts = accounts.filter(a => a.type == type);

    for (const { stakeAddress, voteAddress, lamports } of filteredAccounts) {
      let availableForWithdrawal = Math.floor(calcPoolTokensForDeposit(stakePool, lamports));
      if (!stakePool.stakeWithdrawalFee.denominator.isZero()) {
        availableForWithdrawal = divideBnToNumber(
          new BN(availableForWithdrawal).mul(stakePool.stakeWithdrawalFee.denominator),
          stakePool.stakeWithdrawalFee.denominator.sub(stakePool.stakeWithdrawalFee.numerator),
        );
      }

      const poolAmount = Math.min(availableForWithdrawal, remainingAmount);
      if (poolAmount <= 0) {
        continue;
      }

      // Those accounts will be withdrawn completely with `claim` instruction
      withdrawFrom.push({ stakeAddress, voteAddress, poolAmount });
      remainingAmount -= poolAmount;
      if (remainingAmount == 0) {
        break;
      }
    }
    if (remainingAmount == 0) {
      break;
    }
  }

  // Not enough stake to withdraw the specified amount
  if (remainingAmount > 0) {
    throw new Error(
      `No stake accounts found in this pool with enough balance to withdraw ${lamportsToSol(amount)} pool tokens.`
    );
  }

  return withdrawFrom;
}

/**
 * Calculate the pool tokens that should be minted for a deposit of `stakeLamports`
 */
export function calcPoolTokensForDeposit(stakePool: StakePool, stakeLamports: number): number {
  if (stakePool.poolTokenSupply.isZero() || stakePool.totalLamports.isZero()) {
    return stakeLamports;
  }
  return divideBnToNumber(
    new BN(stakeLamports).mul(stakePool.poolTokenSupply),
    stakePool.totalLamports,
  );
}

/**
 * Calculate lamports amount on withdrawal
 */
export function calcLamportsWithdrawAmount(stakePool: StakePool, poolTokens: number): number {
  const numerator = new BN(poolTokens).mul(stakePool.totalLamports);
  const denominator = stakePool.poolTokenSupply;
  if (numerator.lt(denominator)) {
    return 0;
  }
  return divideBnToNumber(numerator, denominator);
}

export function divideBnToNumber(numerator: BN, denominator: BN): number {
  if (denominator.isZero()) {
    return 0;
  }
  const quotient = numerator.div(denominator).toNumber();
  const rem = numerator.umod(denominator);
  const gcd = rem.gcd(denominator);
  return quotient + rem.div(gcd).toNumber() / denominator.div(gcd).toNumber();
}

export function newStakeAccount(
  feePayer: PublicKey,
  instructions: TransactionInstruction[],
  lamports: number,
): Keypair {
  // Account for tokens not specified, creating one
  const stakeReceiverKeypair = Keypair.generate();
  console.log(`Creating account to receive stake ${stakeReceiverKeypair.publicKey}`);

  instructions.push(
    // Creating new account
    SystemProgram.createAccount({
      fromPubkey: feePayer,
      newAccountPubkey: stakeReceiverKeypair.publicKey,
      lamports,
      space: StakeProgram.space,
      programId: StakeProgram.programId,
    }),
  );

  return stakeReceiverKeypair;
}
