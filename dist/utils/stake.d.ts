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

import { Connection, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import { WithdrawAccount } from '../index';
import { StakePool, ValidatorList } from '../layouts';
export declare function getValidatorListAccount(connection: Connection, pubkey: PublicKey): Promise<{
    pubkey: PublicKey;
    account: {
        data: ValidatorList;
        executable: boolean;
        lamports: number;
        owner: PublicKey;
    };
}>;
export interface ValidatorAccount {
    type: 'preferred' | 'active' | 'transient' | 'reserve';
    voteAddress?: PublicKey | undefined;
    stakeAddress: PublicKey;
    lamports: number;
}
export declare function prepareWithdrawAccounts(connection: Connection, stakePool: StakePool, stakePoolAddress: PublicKey, amount: number, compareFn?: (a: ValidatorAccount, b: ValidatorAccount) => number): Promise<WithdrawAccount[]>;
/**
 * Calculate the pool tokens that should be minted for a deposit of `stakeLamports`
 */
export declare function calcPoolTokensForDeposit(stakePool: StakePool, stakeLamports: number): number;
/**
 * Calculate lamports amount on withdrawal
 */
export declare function calcLamportsWithdrawAmount(stakePool: StakePool, poolTokens: number): number;
export declare function divideBnToNumber(numerator: BN, denominator: BN): number;
export declare function newStakeAccount(feePayer: PublicKey, instructions: TransactionInstruction[], lamports: number): Keypair;
