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
