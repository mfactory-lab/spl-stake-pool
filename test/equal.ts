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

import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { StakePoolAccount, getStakePoolAccounts } from "../src";

export function isStakePoolAccount(account: any): account is StakePoolAccount {
  return (account !== undefined) &&
    (account.account !== undefined) &&
    (account.account.data !== undefined) &&
    ('manager' in account.account.data);
}

export async function getFirstStakePoolAccount(
  connection: Connection,
  stakePoolProgramAddress: PublicKey,
): Promise<StakePoolAccount | undefined> {
  const accounts = await getStakePoolAccounts(connection, stakePoolProgramAddress);

  return accounts!
    .filter(account => isStakePoolAccount(account))
    .pop() as StakePoolAccount;
}

/**
 * Helper function to do deep equality check because BNs are not equal.
 * TODO: write this function recursively. For now, sufficient.
 */
export function deepStrictEqualBN(a: any, b: any) {
  for (const key in a) {
    if (b[key] instanceof BN) {
      expect(b[key].toString()).toEqual(a[key].toString());
    } else {
      if (a[key] instanceof Object) {
        for (const subkey in a[key]) {
          if (a[key][subkey] instanceof Object) {
            if (a[key][subkey] instanceof BN) {
              expect(b[key][subkey].toString()).toEqual(a[key][subkey].toString());
            } else {
              for (const subsubkey in a[key][subkey]) {
                if (a[key][subkey][subsubkey] instanceof BN) {
                  expect(b[key][subkey][subsubkey].toString()).toEqual(a[key][subkey][subsubkey].toString());
                } else {
                  expect(b[key][subkey][subsubkey]).toStrictEqual(a[key][subkey][subsubkey]);
                }
              }
            }
          } else {
            expect(b[key][subkey]).toStrictEqual(a[key][subkey]);
          }
        }
      } else {
        expect(b[key]).toStrictEqual(a[key]);
      }
    }
  }
}
