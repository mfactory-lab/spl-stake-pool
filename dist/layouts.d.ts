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

import { Lockup, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
export interface Fee {
    denominator: BN;
    numerator: BN;
}
/**
 * AccountLayout.encode from "@solana/spl-token" doesn't work
 */
export declare const AccountLayout: any;
export declare enum AccountType {
    Uninitialized = 0,
    StakePool = 1,
    ValidatorList = 2
}
export interface StakePool {
    accountType: AccountType;
    manager: PublicKey;
    staker: PublicKey;
    stakeDepositAuthority: PublicKey;
    stakeWithdrawBumpSeed: number;
    validatorList: PublicKey;
    reserveStake: PublicKey;
    poolMint: PublicKey;
    managerFeeAccount: PublicKey;
    tokenProgramId: PublicKey;
    totalLamports: BN;
    poolTokenSupply: BN;
    lastUpdateEpoch: BN;
    lockup: Lockup;
    epochFee: Fee;
    nextEpochFee?: Fee | undefined;
    preferredDepositValidatorVoteAddress?: PublicKey | undefined;
    preferredWithdrawValidatorVoteAddress?: PublicKey | undefined;
    stakeDepositFee: Fee;
    stakeWithdrawalFee: Fee;
    nextWithdrawalFee?: Fee | undefined;
    stakeReferralFee: number;
    solDepositAuthority?: PublicKey | undefined;
    solDepositFee: Fee;
    solReferralFee: number;
    solWithdrawAuthority?: PublicKey | undefined;
    solWithdrawalFee: Fee;
    nextSolWithdrawalFee?: Fee | undefined;
    lastEpochPoolTokenSupply: BN;
    lastEpochTotalLamports: BN;
}
export declare const StakePoolLayout: any;
export declare enum ValidatorStakeInfoStatus {
    Active = 0,
    DeactivatingTransient = 1,
    ReadyForRemoval = 2
}
export interface ValidatorStakeInfo {
    status: ValidatorStakeInfoStatus;
    voteAccountAddress: PublicKey;
    activeStakeLamports: BN;
    transientStakeLamports: BN;
    transientSeedSuffixStart: BN;
    transientSeedSuffixEnd: BN;
    lastUpdateEpoch: BN;
}
export declare const ValidatorStakeInfoLayout: any;
export interface ValidatorList {
    accountType: number;
    maxValidators: number;
    validators: ValidatorStakeInfo[];
}
export declare const ValidatorListLayout: any;
