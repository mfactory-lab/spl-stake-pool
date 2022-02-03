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

import * as BufferLayout from '@solana/buffer-layout';
/**
 * Layout for a public key
 */
export declare const publicKey: (property?: string) => BufferLayout.Layout<any>;
/**
 * Layout for a 64bit unsigned value
 */
export declare const uint64: (property?: string) => BufferLayout.Layout<any>;
/**
 * Layout for a Rust String type
 */
export declare const rustString: (property?: string) => BufferLayout.Structure<any>;
/**
 * Layout for an Authorized object
 */
export declare const authorized: (property?: string) => BufferLayout.Structure<any>;
/**
 * Layout for a Lockup object
 */
export declare const lockup: (property?: string) => BufferLayout.Structure<any>;
export declare function getAlloc(type: any, fields: any): number;
