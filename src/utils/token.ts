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

import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  AccountInfo,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { AccountLayout } from "../layouts";

const FAILED_TO_FIND_ACCOUNT = 'Failed to find account';
const INVALID_ACCOUNT_OWNER = 'Invalid account owner';

/**
 * Retrieve the associated account or create one if not found.
 * This account may then be used as a `transfer()` or `approve()` destination
 */
export async function addAssociatedTokenAccount(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  instructions: TransactionInstruction[],
) {
  const associatedAddress = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    owner,
  );

  // This is the optimum logic, considering TX fee, client-side computation,
  // RPC roundtrips and guaranteed idempotent.
  // Sadly we can't do this atomically;
  try {
    const account = await connection.getAccountInfo(associatedAddress);
    if (!account) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(FAILED_TO_FIND_ACCOUNT);
    }
  } catch (err: any) {
    // INVALID_ACCOUNT_OWNER can be possible if the associatedAddress has
    // already been received some lamports (= became system accounts).
    // Assuming program derived addressing is safe, this is the only case
    // for the INVALID_ACCOUNT_OWNER in this code-path
    if (err.message === FAILED_TO_FIND_ACCOUNT || err.message === INVALID_ACCOUNT_OWNER) {
      instructions.push(
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          mint,
          associatedAddress,
          owner,
          owner,
        ),
      );
    } else {
      throw err;
    }
    console.warn(err);
  }

  return associatedAddress;
}

export async function getTokenAccount(
  connection: Connection,
  tokenAccountAddress: PublicKey,
  expectedTokenMint: PublicKey,
): Promise<AccountInfo | void> {
  try {
    const account = await connection.getAccountInfo(tokenAccountAddress);
    if (!account) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(`Invalid account ${tokenAccountAddress.toBase58()}`);
    }
    const tokenAccount = AccountLayout.decode(account.data) as AccountInfo;
    if (tokenAccount.mint?.toBase58() != expectedTokenMint.toBase58()) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(
        `Invalid token mint for ${tokenAccountAddress}, expected mint is ${expectedTokenMint}`,
      );
    }
    return tokenAccount;
  } catch (error) {
    console.log(error);
  }
}
