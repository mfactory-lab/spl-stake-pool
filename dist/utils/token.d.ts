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

import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { AccountInfo, MintInfo } from '@solana/spl-token';
export declare function getTokenMint(connection: Connection, tokenMintPubkey: PublicKey): Promise<MintInfo | undefined>;
/**
 * Retrieve the associated account or create one if not found.
 * This account may then be used as a `transfer()` or `approve()` destination
 */
export declare function addAssociatedTokenAccount(connection: Connection, owner: PublicKey, mint: PublicKey, instructions: TransactionInstruction[]): Promise<PublicKey>;
export declare function getTokenAccount(connection: Connection, tokenAccountAddress: PublicKey, expectedTokenMint: PublicKey): Promise<AccountInfo | void>;
