import { PublicKey } from '@solana/web3.js';
import { struct, u32, u8 } from '@solana/buffer-layout';
import BN from 'bn.js';
import { number, nullable, enums, type, coerce, instance, string, optional, } from 'superstruct';
import { publicKey, option, u64, vec } from './utils';
const lockup = (property) => struct([u64('unixTimestamp'), u64('epoch'), publicKey('custodian')], property);
const fee = (property) => struct([u64('denominator'), u64('numerator')], property);
/**
 * AccountLayout.encode from "@solana/spl-token" doesn't work
 */
export const AccountLayout = struct([
    publicKey('mint'),
    publicKey('owner'),
    u64('amount'),
    u32('delegateOption'),
    publicKey('delegate'),
    u8('state'),
    u32('isNativeOption'),
    u64('isNative'),
    u64('delegatedAmount'),
    u32('closeAuthorityOption'),
    publicKey('closeAuthority'),
]);
export var AccountType;
(function (AccountType) {
    AccountType[AccountType["Uninitialized"] = 0] = "Uninitialized";
    AccountType[AccountType["StakePool"] = 1] = "StakePool";
    AccountType[AccountType["ValidatorList"] = 2] = "ValidatorList";
})(AccountType || (AccountType = {}));
export const BigNumFromString = coerce(instance(BN), string(), (value) => {
    if (typeof value === 'string')
        return new BN(value, 10);
    throw new Error('invalid big num');
});
export const PublicKeyFromString = coerce(instance(PublicKey), string(), (value) => new PublicKey(value));
export const StakeAccountType = enums(['uninitialized', 'initialized', 'delegated', 'rewardsPool']);
export const StakeMeta = type({
    rentExemptReserve: BigNumFromString,
    authorized: type({
        staker: PublicKeyFromString,
        withdrawer: PublicKeyFromString,
    }),
    lockup: type({
        unixTimestamp: number(),
        epoch: number(),
        custodian: PublicKeyFromString,
    }),
});
export const StakeAccountInfo = type({
    meta: StakeMeta,
    stake: nullable(type({
        delegation: type({
            voter: PublicKeyFromString,
            stake: BigNumFromString,
            activationEpoch: BigNumFromString,
            deactivationEpoch: BigNumFromString,
            warmupCooldownRate: number(),
        }),
        creditsObserved: number(),
    })),
});
export const StakeAccount = type({
    type: StakeAccountType,
    info: optional(StakeAccountInfo),
});
export const StakePoolLayout = struct([
    u8('accountType'),
    publicKey('manager'),
    publicKey('staker'),
    publicKey('stakeDepositAuthority'),
    u8('stakeWithdrawBumpSeed'),
    publicKey('validatorList'),
    publicKey('reserveStake'),
    publicKey('poolMint'),
    publicKey('managerFeeAccount'),
    publicKey('tokenProgramId'),
    u64('totalLamports'),
    u64('poolTokenSupply'),
    u64('lastUpdateEpoch'),
    lockup('lockup'),
    fee('epochFee'),
    option(fee('nextEpochFee')),
    option(publicKey('preferredDepositValidatorVoteAddress')),
    option(publicKey('preferredWithdrawValidatorVoteAddress')),
    fee('stakeDepositFee'),
    fee('stakeWithdrawalFee'),
    option(fee('nextStakeWithdrawalFee')),
    u8('stakeReferralFee'),
    option(publicKey('solDepositAuthority')),
    fee('solDepositFee'),
    u8('solReferralFee'),
    option(publicKey('solWithdrawAuthority')),
    fee('solWithdrawalFee'),
    option(fee('nextSolWithdrawalFee')),
    u64('lastEpochPoolTokenSupply'),
    u64('lastEpochTotalLamports'),
]);
export var ValidatorStakeInfoStatus;
(function (ValidatorStakeInfoStatus) {
    ValidatorStakeInfoStatus[ValidatorStakeInfoStatus["Active"] = 0] = "Active";
    ValidatorStakeInfoStatus[ValidatorStakeInfoStatus["DeactivatingTransient"] = 1] = "DeactivatingTransient";
    ValidatorStakeInfoStatus[ValidatorStakeInfoStatus["ReadyForRemoval"] = 2] = "ReadyForRemoval";
})(ValidatorStakeInfoStatus || (ValidatorStakeInfoStatus = {}));
export const ValidatorStakeInfoLayout = struct([
    /// Amount of active stake delegated to this validator
    /// Note that if `last_update_epoch` does not match the current epoch then
    /// this field may not be accurate
    u64('activeStakeLamports'),
    /// Amount of transient stake delegated to this validator
    /// Note that if `last_update_epoch` does not match the current epoch then
    /// this field may not be accurate
    u64('transientStakeLamports'),
    /// Last epoch the active and transient stake lamports fields were updated
    u64('lastUpdateEpoch'),
    /// Start of the validator transient account seed suffixes
    u64('transientSeedSuffixStart'),
    /// End of the validator transient account seed suffixes
    u64('transientSeedSuffixEnd'),
    /// Status of the validator stake account
    u8('status'),
    /// Validator vote account address
    publicKey('voteAccountAddress'),
]);
export const ValidatorListLayout = struct([
    u8('accountType'),
    u32('maxValidators'),
    vec(ValidatorStakeInfoLayout, 'validators'),
]);
