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

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var web3_js = require('@solana/web3.js');
var splToken = require('@solana/spl-token');
var buffer = require('buffer');
var BufferLayout = require('@solana/buffer-layout');
var borsh = require('@project-serum/borsh');
var BN = require('bn.js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n["default"] = e;
    return Object.freeze(n);
}

var BufferLayout__namespace = /*#__PURE__*/_interopNamespace(BufferLayout);
var BN__default = /*#__PURE__*/_interopDefaultLegacy(BN);

function solToLamports(amount) {
    if (isNaN(amount))
        return Number(0);
    return Number(amount * web3_js.LAMPORTS_PER_SOL);
}
function lamportsToSol(lamports) {
    if (typeof lamports === 'number') {
        return Math.abs(lamports) / web3_js.LAMPORTS_PER_SOL;
    }
    let signMultiplier = 1;
    if (lamports.isNeg()) {
        signMultiplier = -1;
    }
    const absLamports = lamports.abs();
    const lamportsString = absLamports.toString(10).padStart(10, '0');
    const splitIndex = lamportsString.length - 9;
    const solString = lamportsString.slice(0, splitIndex) + '.' + lamportsString.slice(splitIndex);
    return signMultiplier * parseFloat(solString);
}

// Public key that identifies the SPL Stake Pool program.
const STAKE_POOL_PROGRAM_ID = new web3_js.PublicKey('SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy');
// Maximum number of validators to update during UpdateValidatorListBalance.
const MAX_VALIDATORS_TO_UPDATE = 5;
// Seed used to derive transient stake accounts.
const TRANSIENT_STAKE_SEED_PREFIX = buffer.Buffer.from('transient');
const MIN_STAKE_BALANCE = solToLamports(0.001);
const STAKE_STATE_LEN = 200;

/**
 * Generates the withdraw authority program address for the stake pool
 */
async function findWithdrawAuthorityProgramAddress(programId, stakePoolAddress) {
    const [publicKey] = await web3_js.PublicKey.findProgramAddress([stakePoolAddress.toBuffer(), buffer.Buffer.from('withdraw')], programId);
    return publicKey;
}
/**
 * Generates the stake program address for a validator's vote account
 */
async function findStakeProgramAddress(programId, voteAccountAddress, stakePoolAddress) {
    const [publicKey] = await web3_js.PublicKey.findProgramAddress([voteAccountAddress.toBuffer(), stakePoolAddress.toBuffer()], programId);
    return publicKey;
}
/**
 * Generates the stake program address for a validator's vote account
 */
async function findTransientStakeProgramAddress(programId, voteAccountAddress, stakePoolAddress, seed) {
    const [publicKey] = await web3_js.PublicKey.findProgramAddress([
        TRANSIENT_STAKE_SEED_PREFIX,
        voteAccountAddress.toBuffer(),
        stakePoolAddress.toBuffer(),
        new Uint8Array(seed.toArray('le', 8)),
    ], programId);
    return publicKey;
}

const feeFields = [borsh.u64('denominator'), borsh.u64('numerator')];
/**
 * AccountLayout.encode from "@solana/spl-token" doesn't work
 */
const AccountLayout = borsh.struct([
    borsh.publicKey('mint'),
    borsh.publicKey('owner'),
    borsh.u64('amount'),
    borsh.u32('delegateOption'),
    borsh.publicKey('delegate'),
    borsh.u8('state'),
    borsh.u32('isNativeOption'),
    borsh.u64('isNative'),
    borsh.u64('delegatedAmount'),
    borsh.u32('closeAuthorityOption'),
    borsh.publicKey('closeAuthority'),
]);
var AccountType;
(function (AccountType) {
    AccountType[AccountType["Uninitialized"] = 0] = "Uninitialized";
    AccountType[AccountType["StakePool"] = 1] = "StakePool";
    AccountType[AccountType["ValidatorList"] = 2] = "ValidatorList";
})(AccountType || (AccountType = {}));
const StakePoolLayout = borsh.struct([
    borsh.u8('accountType'),
    borsh.publicKey('manager'),
    borsh.publicKey('staker'),
    borsh.publicKey('stakeDepositAuthority'),
    borsh.u8('stakeWithdrawBumpSeed'),
    borsh.publicKey('validatorList'),
    borsh.publicKey('reserveStake'),
    borsh.publicKey('poolMint'),
    borsh.publicKey('managerFeeAccount'),
    borsh.publicKey('tokenProgramId'),
    borsh.u64('totalLamports'),
    borsh.u64('poolTokenSupply'),
    borsh.u64('lastUpdateEpoch'),
    borsh.struct([borsh.u64('unixTimestamp'), borsh.u64('epoch'), borsh.publicKey('custodian')], 'lockup'),
    borsh.struct(feeFields, 'epochFee'),
    borsh.option(borsh.struct(feeFields), 'nextEpochFee'),
    borsh.option(borsh.publicKey(), 'preferredDepositValidatorVoteAddress'),
    borsh.option(borsh.publicKey(), 'preferredWithdrawValidatorVoteAddress'),
    borsh.struct(feeFields, 'stakeDepositFee'),
    borsh.struct(feeFields, 'stakeWithdrawalFee'),
    borsh.option(borsh.struct(feeFields), 'nextWithdrawalFee'),
    borsh.u8('stakeReferralFee'),
    borsh.option(borsh.publicKey(), 'solDepositAuthority'),
    borsh.struct(feeFields, 'solDepositFee'),
    borsh.u8('solReferralFee'),
    borsh.option(borsh.publicKey(), 'solWithdrawAuthority'),
    borsh.struct(feeFields, 'solWithdrawalFee'),
    borsh.option(borsh.struct(feeFields), 'nextSolWithdrawalFee'),
    borsh.u64('lastEpochPoolTokenSupply'),
    borsh.u64('lastEpochTotalLamports'),
]);
var ValidatorStakeInfoStatus;
(function (ValidatorStakeInfoStatus) {
    ValidatorStakeInfoStatus[ValidatorStakeInfoStatus["Active"] = 0] = "Active";
    ValidatorStakeInfoStatus[ValidatorStakeInfoStatus["DeactivatingTransient"] = 1] = "DeactivatingTransient";
    ValidatorStakeInfoStatus[ValidatorStakeInfoStatus["ReadyForRemoval"] = 2] = "ReadyForRemoval";
})(ValidatorStakeInfoStatus || (ValidatorStakeInfoStatus = {}));
const ValidatorStakeInfoLayout = borsh.struct([
    /// Amount of active stake delegated to this validator
    /// Note that if `last_update_epoch` does not match the current epoch then
    /// this field may not be accurate
    borsh.u64('activeStakeLamports'),
    /// Amount of transient stake delegated to this validator
    /// Note that if `last_update_epoch` does not match the current epoch then
    /// this field may not be accurate
    borsh.u64('transientStakeLamports'),
    /// Last epoch the active and transient stake lamports fields were updated
    borsh.u64('lastUpdateEpoch'),
    /// Start of the validator transient account seed suffixes
    borsh.u64('transientSeedSuffixStart'),
    /// End of the validator transient account seed suffixes
    borsh.u64('transientSeedSuffixEnd'),
    /// Status of the validator stake account
    borsh.u8('status'),
    /// Validator vote account address
    borsh.publicKey('voteAccountAddress'),
]);
const ValidatorListLayout = borsh.struct([
    borsh.u8('accountType'),
    borsh.u32('maxValidators'),
    borsh.vec(ValidatorStakeInfoLayout, 'validators'),
]);

async function getValidatorListAccount(connection, pubkey) {
    const account = await connection.getAccountInfo(pubkey);
    if (!account) {
        throw new Error('Invalid validator list account');
    }
    return {
        pubkey,
        account: {
            data: ValidatorListLayout.decode(account === null || account === void 0 ? void 0 : account.data),
            executable: account.executable,
            lamports: account.lamports,
            owner: account.owner,
        },
    };
}
async function prepareWithdrawAccounts(connection, stakePool, stakePoolAddress, amount, compareFn) {
    var _a, _b;
    const validatorListAcc = await connection.getAccountInfo(stakePool.validatorList);
    const validatorList = ValidatorListLayout.decode(validatorListAcc === null || validatorListAcc === void 0 ? void 0 : validatorListAcc.data);
    if (!(validatorList === null || validatorList === void 0 ? void 0 : validatorList.validators) || (validatorList === null || validatorList === void 0 ? void 0 : validatorList.validators.length) == 0) {
        throw new Error('No accounts found');
    }
    let accounts = [];
    // Prepare accounts
    for (const validator of validatorList.validators) {
        if (validator.status !== ValidatorStakeInfoStatus.Active) {
            continue;
        }
        const stakeAccountAddress = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validator.voteAccountAddress, stakePoolAddress);
        if (!validator.activeStakeLamports.isZero()) {
            const isPreferred = ((_a = stakePool === null || stakePool === void 0 ? void 0 : stakePool.preferredWithdrawValidatorVoteAddress) === null || _a === void 0 ? void 0 : _a.toBase58()) ==
                validator.voteAccountAddress.toBase58();
            accounts.push({
                type: isPreferred ? 'preferred' : 'active',
                voteAddress: validator.voteAccountAddress,
                stakeAddress: stakeAccountAddress,
                lamports: validator.activeStakeLamports.toNumber(),
            });
        }
        const transientStakeAccountAddress = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validator.voteAccountAddress, stakePoolAddress, validator === null || validator === void 0 ? void 0 : validator.transientSeedSuffixStart);
        if (!((_b = validator.transientStakeLamports) === null || _b === void 0 ? void 0 : _b.isZero())) {
            accounts.push({
                type: 'transient',
                voteAddress: validator.voteAccountAddress,
                stakeAddress: transientStakeAccountAddress,
                lamports: validator === null || validator === void 0 ? void 0 : validator.transientStakeLamports.toNumber(),
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
            lamports: reserveStake === null || reserveStake === void 0 ? void 0 : reserveStake.lamports,
        });
    }
    // Prepare the list of accounts to withdraw from
    const withdrawFrom = [];
    let remainingAmount = amount;
    for (const type of ['preferred', 'active', 'transient', 'reserve']) {
        const filteredAccounts = accounts.filter(a => a.type == type);
        for (const { stakeAddress, voteAddress, lamports } of filteredAccounts) {
            let availableForWithdrawal = Math.floor(calcPoolTokensForDeposit(stakePool, lamports));
            if (!stakePool.stakeWithdrawalFee.denominator.isZero()) {
                availableForWithdrawal = divideBnToNumber(new BN__default["default"](availableForWithdrawal).mul(stakePool.stakeWithdrawalFee.denominator), stakePool.stakeWithdrawalFee.denominator.sub(stakePool.stakeWithdrawalFee.numerator));
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
        throw new Error(`No stake accounts found in this pool with enough balance to withdraw ${lamportsToSol(amount)} pool tokens.`);
    }
    return withdrawFrom;
}
/**
 * Calculate the pool tokens that should be minted for a deposit of `stakeLamports`
 */
function calcPoolTokensForDeposit(stakePool, stakeLamports) {
    if (stakePool.poolTokenSupply.isZero() || stakePool.totalLamports.isZero()) {
        return stakeLamports;
    }
    return divideBnToNumber(new BN__default["default"](stakeLamports).mul(stakePool.poolTokenSupply), stakePool.totalLamports);
}
/**
 * Calculate lamports amount on withdrawal
 */
function calcLamportsWithdrawAmount(stakePool, poolTokens) {
    const numerator = new BN__default["default"](poolTokens).mul(stakePool.totalLamports);
    const denominator = stakePool.poolTokenSupply;
    if (numerator.lt(denominator)) {
        return 0;
    }
    return divideBnToNumber(numerator, denominator);
}
function divideBnToNumber(numerator, denominator) {
    if (denominator.isZero()) {
        return 0;
    }
    const quotient = numerator.div(denominator).toNumber();
    const rem = numerator.umod(denominator);
    const gcd = rem.gcd(denominator);
    return quotient + rem.div(gcd).toNumber() / denominator.div(gcd).toNumber();
}
function newStakeAccount(feePayer, instructions, lamports) {
    // Account for tokens not specified, creating one
    const stakeReceiverKeypair = web3_js.Keypair.generate();
    console.log(`Creating account to receive stake ${stakeReceiverKeypair.publicKey}`);
    instructions.push(
    // Creating new account
    web3_js.SystemProgram.createAccount({
        fromPubkey: feePayer,
        newAccountPubkey: stakeReceiverKeypair.publicKey,
        lamports,
        space: web3_js.StakeProgram.space,
        programId: web3_js.StakeProgram.programId,
    }));
    return stakeReceiverKeypair;
}

const FAILED_TO_FIND_ACCOUNT = 'Failed to find account';
const INVALID_ACCOUNT_OWNER = 'Invalid account owner';
/**
 * Retrieve the associated account or create one if not found.
 * This account may then be used as a `transfer()` or `approve()` destination
 */
async function addAssociatedTokenAccount(connection, owner, mint, instructions) {
    const associatedAddress = await splToken.Token.getAssociatedTokenAddress(splToken.ASSOCIATED_TOKEN_PROGRAM_ID, splToken.TOKEN_PROGRAM_ID, mint, owner);
    // This is the optimum logic, considering TX fee, client-side computation,
    // RPC roundtrips and guaranteed idempotent.
    // Sadly we can't do this atomically;
    try {
        const account = await connection.getAccountInfo(associatedAddress);
        if (!account) {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error(FAILED_TO_FIND_ACCOUNT);
        }
    }
    catch (err) {
        // INVALID_ACCOUNT_OWNER can be possible if the associatedAddress has
        // already been received some lamports (= became system accounts).
        // Assuming program derived addressing is safe, this is the only case
        // for the INVALID_ACCOUNT_OWNER in this code-path
        if (err.message === FAILED_TO_FIND_ACCOUNT || err.message === INVALID_ACCOUNT_OWNER) {
            instructions.push(splToken.Token.createAssociatedTokenAccountInstruction(splToken.ASSOCIATED_TOKEN_PROGRAM_ID, splToken.TOKEN_PROGRAM_ID, mint, associatedAddress, owner, owner));
        }
        else {
            throw err;
        }
        console.warn(err);
    }
    return associatedAddress;
}
async function getTokenAccount(connection, tokenAccountAddress, expectedTokenMint) {
    var _a;
    try {
        const account = await connection.getAccountInfo(tokenAccountAddress);
        if (!account) {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error(`Invalid account ${tokenAccountAddress.toBase58()}`);
        }
        const tokenAccount = AccountLayout.decode(account.data);
        if (((_a = tokenAccount.mint) === null || _a === void 0 ? void 0 : _a.toBase58()) != expectedTokenMint.toBase58()) {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error(`Invalid token mint for ${tokenAccountAddress}, expected mint is ${expectedTokenMint}`);
        }
        return tokenAccount;
    }
    catch (error) {
        console.log(error);
    }
}

function arrayChunk(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

function getAlloc(type, fields) {
    let alloc = 0;
    type.layout.fields.forEach((item) => {
        if (item.span >= 0) {
            alloc += item.span;
        }
        else if (typeof item.alloc === 'function') {
            alloc += item.alloc(fields[item.property]);
        }
    });
    return alloc;
}

/**
 * Populate a buffer of instruction data using an InstructionType
 * @internal
 */
function encodeData(type, fields) {
    const allocLength = type.layout.span >= 0 ? type.layout.span : getAlloc(type, fields);
    const data = buffer.Buffer.alloc(allocLength);
    const layoutFields = Object.assign({ instruction: type.index }, fields);
    type.layout.encode(layoutFields, data);
    return data;
}
/**
 * Decode instruction data buffer using an InstructionType
 * @internal
 */
function decodeData(type, buffer) {
    let data;
    try {
        data = type.layout.decode(buffer);
    }
    catch (err) {
        throw new Error('invalid instruction; ' + err);
    }
    if (data.instruction !== type.index) {
        throw new Error(`invalid instruction; instruction index mismatch ${data.instruction} != ${type.index}`);
    }
    return data;
}

/**
 * Based on https://github.com/solana-labs/solana-web3.js/blob/master/src/stake-program.ts
 * https://github.com/solana-labs/solana-program-library/
 */
const MOVE_STAKE_LAYOUT = BufferLayout__namespace.struct([
    BufferLayout__namespace.u8('instruction'),
    BufferLayout__namespace.ns64('lamports'),
    BufferLayout__namespace.ns64('transientStakeSeed'),
]);
const UPDATE_VALIDATOR_LIST_BALANCE_LAYOUT = BufferLayout__namespace.struct([
    BufferLayout__namespace.u8('instruction'),
    BufferLayout__namespace.u32('startIndex'),
    BufferLayout__namespace.u8('noMerge'),
]);
/**
 * An enumeration of valid stake InstructionType's
 * @internal
 */
const STAKE_POOL_INSTRUCTION_LAYOUTS = Object.freeze({
    DecreaseValidatorStake: {
        index: 3,
        layout: MOVE_STAKE_LAYOUT,
    },
    IncreaseValidatorStake: {
        index: 4,
        layout: MOVE_STAKE_LAYOUT,
    },
    UpdateValidatorListBalance: {
        index: 6,
        layout: UPDATE_VALIDATOR_LIST_BALANCE_LAYOUT,
    },
    UpdateStakePoolBalance: {
        index: 7,
        layout: BufferLayout__namespace.struct([BufferLayout__namespace.u8('instruction')]),
    },
    CleanupRemovedValidatorEntries: {
        index: 8,
        layout: BufferLayout__namespace.struct([BufferLayout__namespace.u8('instruction')]),
    },
    DepositStake: {
        index: 9,
        layout: BufferLayout__namespace.struct([BufferLayout__namespace.u8('instruction')]),
    },
    /// Withdraw the token from the pool at the current ratio.
    WithdrawStake: {
        index: 10,
        layout: BufferLayout__namespace.struct([
            BufferLayout__namespace.u8('instruction'),
            BufferLayout__namespace.ns64('poolTokens'),
        ]),
    },
    /// Deposit SOL directly into the pool's reserve account. The output is a "pool" token
    /// representing ownership into the pool. Inputs are converted to the current ratio.
    DepositSol: {
        index: 14,
        layout: BufferLayout__namespace.struct([
            BufferLayout__namespace.u8('instruction'),
            BufferLayout__namespace.ns64('lamports'),
        ]),
    },
    /// Withdraw SOL directly from the pool's reserve account. Fails if the
    /// reserve does not have enough SOL.
    WithdrawSol: {
        index: 16,
        layout: BufferLayout__namespace.struct([
            BufferLayout__namespace.u8('instruction'),
            BufferLayout__namespace.ns64('poolTokens'),
        ]),
    },
});
/**
 * Stake Pool Instruction class
 */
class StakePoolInstruction {
    /**
     * Creates instruction to update a set of validators in the stake pool.
     */
    static updateValidatorListBalance(params) {
        const { stakePool, withdrawAuthority, validatorList, reserveStake, startIndex, noMerge, validatorAndTransientStakePairs, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.UpdateValidatorListBalance;
        const data = encodeData(type, { startIndex, noMerge: noMerge ? 1 : 0 });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: web3_js.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: web3_js.SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: web3_js.StakeProgram.programId, isSigner: false, isWritable: false },
            ...validatorAndTransientStakePairs.map(pubkey => ({
                pubkey,
                isSigner: false,
                isWritable: true,
            })),
        ];
        return new web3_js.TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates instruction to update the overall stake pool balance.
     */
    static updateStakePoolBalance(params) {
        const { stakePool, withdrawAuthority, validatorList, reserveStake, managerFeeAccount, poolMint } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.UpdateStakePoolBalance;
        const data = encodeData(type);
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: true },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: false },
            { pubkey: managerFeeAccount, isSigner: false, isWritable: false },
            { pubkey: poolMint, isSigner: false, isWritable: true },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];
        return new web3_js.TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates instruction to cleanup removed validator entries.
     */
    static cleanupRemovedValidatorEntries(params) {
        const { stakePool, validatorList } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.CleanupRemovedValidatorEntries;
        const data = encodeData(type);
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
        ];
        return new web3_js.TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates instruction to increase the stake on a validator.
     */
    static increaseValidatorStake(params) {
        const { stakePool, staker, withdrawAuthority, validatorList, reserveStake, transientStake, validatorVote, lamports, transientStakeSeed, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.IncreaseValidatorStake;
        const data = encodeData(type, { lamports, transientStakeSeed });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: staker, isSigner: true, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: transientStake, isSigner: false, isWritable: true },
            { pubkey: validatorVote, isSigner: false, isWritable: false },
            { pubkey: web3_js.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: web3_js.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: web3_js.SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: web3_js.STAKE_CONFIG_ID, isSigner: false, isWritable: false },
            { pubkey: web3_js.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: web3_js.StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new web3_js.TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates instruction to decrease the stake on a validator.
     */
    static decreaseValidatorStake(params) {
        const { stakePool, staker, withdrawAuthority, validatorList, validatorStake, transientStake, lamports, transientStakeSeed, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.DecreaseValidatorStake;
        const data = encodeData(type, { lamports, transientStakeSeed });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: false },
            { pubkey: staker, isSigner: true, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: validatorStake, isSigner: false, isWritable: true },
            { pubkey: transientStake, isSigner: false, isWritable: true },
            { pubkey: web3_js.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: web3_js.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: web3_js.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: web3_js.StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new web3_js.TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates a transaction instruction to deposit SOL into a stake pool.
     */
    static depositStake(params) {
        const { stakePool, validatorList, depositAuthority, withdrawAuthority, depositStake, validatorStake, reserveStake, destinationPoolAccount, managerFeeAccount, referralPoolAccount, poolMint, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.DepositStake;
        const data = encodeData(type);
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: true },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: depositAuthority, isSigner: false, isWritable: false },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: depositStake, isSigner: false, isWritable: true },
            { pubkey: validatorStake, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: destinationPoolAccount, isSigner: false, isWritable: true },
            { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
            { pubkey: referralPoolAccount, isSigner: false, isWritable: true },
            { pubkey: poolMint, isSigner: false, isWritable: true },
            { pubkey: web3_js.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: web3_js.SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: web3_js.StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new web3_js.TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates a transaction instruction to withdraw SOL from a stake pool.
     */
    static depositSol(params) {
        const { stakePool, withdrawAuthority, depositAuthority, reserveStake, fundingAccount, destinationPoolAccount, managerFeeAccount, referralPoolAccount, poolMint, lamports, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.DepositSol;
        const data = encodeData(type, { lamports });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: true },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: fundingAccount, isSigner: true, isWritable: true },
            { pubkey: destinationPoolAccount, isSigner: false, isWritable: true },
            { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
            { pubkey: referralPoolAccount, isSigner: false, isWritable: true },
            { pubkey: poolMint, isSigner: false, isWritable: true },
            { pubkey: web3_js.SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];
        if (depositAuthority) {
            keys.push({
                pubkey: depositAuthority,
                isSigner: true,
                isWritable: false,
            });
        }
        return new web3_js.TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates a transaction instruction to withdraw SOL from a stake pool.
     */
    static withdrawStake(params) {
        const { stakePool, validatorList, withdrawAuthority, validatorStake, destinationStake, destinationStakeAuthority, sourceTransferAuthority, sourcePoolAccount, managerFeeAccount, poolMint, poolTokens, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawStake;
        const data = encodeData(type, { poolTokens });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: true },
            { pubkey: validatorList, isSigner: false, isWritable: true },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: validatorStake, isSigner: false, isWritable: true },
            { pubkey: destinationStake, isSigner: false, isWritable: true },
            { pubkey: destinationStakeAuthority, isSigner: false, isWritable: false },
            { pubkey: sourceTransferAuthority, isSigner: true, isWritable: false },
            { pubkey: sourcePoolAccount, isSigner: false, isWritable: true },
            { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
            { pubkey: poolMint, isSigner: false, isWritable: true },
            { pubkey: web3_js.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: web3_js.StakeProgram.programId, isSigner: false, isWritable: false },
        ];
        return new web3_js.TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Creates a transaction instruction to withdraw SOL from a stake pool.
     */
    static withdrawSol(params) {
        const { stakePool, withdrawAuthority, sourceTransferAuthority, sourcePoolAccount, reserveStake, destinationSystemAccount, managerFeeAccount, solWithdrawAuthority, poolMint, poolTokens, } = params;
        const type = STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawSol;
        const data = encodeData(type, { poolTokens });
        const keys = [
            { pubkey: stakePool, isSigner: false, isWritable: true },
            { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
            { pubkey: sourceTransferAuthority, isSigner: true, isWritable: false },
            { pubkey: sourcePoolAccount, isSigner: false, isWritable: true },
            { pubkey: reserveStake, isSigner: false, isWritable: true },
            { pubkey: destinationSystemAccount, isSigner: false, isWritable: true },
            { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
            { pubkey: poolMint, isSigner: false, isWritable: true },
            { pubkey: web3_js.SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: web3_js.SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: web3_js.StakeProgram.programId, isSigner: false, isWritable: false },
            { pubkey: splToken.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];
        if (solWithdrawAuthority) {
            keys.push({
                pubkey: solWithdrawAuthority,
                isSigner: true,
                isWritable: false,
            });
        }
        return new web3_js.TransactionInstruction({
            programId: STAKE_POOL_PROGRAM_ID,
            keys,
            data,
        });
    }
    /**
     * Decode a deposit stake pool instruction and retrieve the instruction params.
     */
    static decodeDepositStake(instruction) {
        this.checkProgramId(instruction.programId);
        this.checkKeyLength(instruction.keys, 11);
        decodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.DepositStake, instruction.data);
        return {
            stakePool: instruction.keys[0].pubkey,
            validatorList: instruction.keys[1].pubkey,
            depositAuthority: instruction.keys[2].pubkey,
            withdrawAuthority: instruction.keys[3].pubkey,
            depositStake: instruction.keys[4].pubkey,
            validatorStake: instruction.keys[5].pubkey,
            reserveStake: instruction.keys[6].pubkey,
            destinationPoolAccount: instruction.keys[7].pubkey,
            managerFeeAccount: instruction.keys[8].pubkey,
            referralPoolAccount: instruction.keys[9].pubkey,
            poolMint: instruction.keys[10].pubkey,
        };
    }
    /**
     * Decode a deposit sol instruction and retrieve the instruction params.
     */
    static decodeDepositSol(instruction) {
        this.checkProgramId(instruction.programId);
        this.checkKeyLength(instruction.keys, 9);
        const { amount } = decodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.DepositSol, instruction.data);
        return {
            stakePool: instruction.keys[0].pubkey,
            depositAuthority: instruction.keys[1].pubkey,
            withdrawAuthority: instruction.keys[2].pubkey,
            reserveStake: instruction.keys[3].pubkey,
            fundingAccount: instruction.keys[4].pubkey,
            destinationPoolAccount: instruction.keys[5].pubkey,
            managerFeeAccount: instruction.keys[6].pubkey,
            referralPoolAccount: instruction.keys[7].pubkey,
            poolMint: instruction.keys[8].pubkey,
            lamports: amount,
        };
    }
    /**
     * @internal
     */
    static checkProgramId(programId) {
        if (!programId.equals(web3_js.StakeProgram.programId)) {
            throw new Error('Invalid instruction; programId is not StakeProgram');
        }
    }
    /**
     * @internal
     */
    static checkKeyLength(keys, expectedLength) {
        if (keys.length < expectedLength) {
            throw new Error(`Invalid instruction; found ${keys.length} keys, expected at least ${expectedLength}`);
        }
    }
}

/**
 * Retrieves and deserializes a StakePool account using a web3js connection and the stake pool address.
 * @param connection: An active web3js connection.
 * @param stakePoolAddress: The public key (address) of the stake pool account.
 */
async function getStakePoolAccount(connection, stakePoolAddress) {
    const account = await connection.getAccountInfo(stakePoolAddress);
    if (!account) {
        throw new Error('Invalid stake pool account');
    }
    return {
        pubkey: stakePoolAddress,
        account: {
            data: StakePoolLayout.decode(account.data),
            executable: account.executable,
            lamports: account.lamports,
            owner: account.owner,
        },
    };
}
/**
 * Retrieves all StakePool and ValidatorList accounts that are running a particular StakePool program.
 * @param connection: An active web3js connection.
 * @param stakePoolAddress: The public key (address) of the StakePool program.
 */
async function getStakePoolAccounts(connection, stakePoolAddress) {
    const response = await connection.getProgramAccounts(stakePoolAddress);
    return response.map(a => {
        let decodedData;
        if (a.account.data.readUInt8() === 1) {
            try {
                decodedData = StakePoolLayout.decode(a.account.data);
            }
            catch (error) {
                console.log('Could not decode StakeAccount. Error:', error);
                decodedData = undefined;
            }
        }
        else if (a.account.data.readUInt8() === 2) {
            try {
                decodedData = ValidatorListLayout.decode(a.account.data);
            }
            catch (error) {
                console.log('Could not decode ValidatorList. Error:', error);
                decodedData = undefined;
            }
        }
        else {
            console.error(`Could not decode. StakePoolAccount Enum is ${a.account.data.readUInt8()}, expected 1 or 2!`);
            decodedData = undefined;
        }
        return {
            pubkey: a.pubkey,
            account: {
                data: decodedData,
                executable: a.account.executable,
                lamports: a.account.lamports,
                owner: a.account.owner,
            },
        };
    });
}
/**
 * Creates instructions required to deposit stake to stake pool.
 */
async function depositStake(connection, stakePoolAddress, authorizedPubkey, validatorVote, depositStake, poolTokenReceiverAccount) {
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const validatorStake = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorVote, stakePoolAddress);
    const instructions = [];
    const signers = [];
    const poolMint = stakePool.account.data.poolMint;
    let rentFee = 0;
    // Create token account if not specified
    if (!poolTokenReceiverAccount) {
        poolTokenReceiverAccount = await addAssociatedTokenAccount(connection, authorizedPubkey, poolMint, instructions);
        if (instructions.length > 0) {
            rentFee = await connection.getMinimumBalanceForRentExemption(STAKE_STATE_LEN);
        }
    }
    instructions.push(...web3_js.StakeProgram.authorize({
        stakePubkey: depositStake,
        authorizedPubkey,
        newAuthorizedPubkey: stakePool.account.data.stakeDepositAuthority,
        stakeAuthorizationType: web3_js.StakeAuthorizationLayout.Staker,
    }).instructions);
    instructions.push(...web3_js.StakeProgram.authorize({
        stakePubkey: depositStake,
        authorizedPubkey,
        newAuthorizedPubkey: stakePool.account.data.stakeDepositAuthority,
        stakeAuthorizationType: web3_js.StakeAuthorizationLayout.Withdrawer,
    }).instructions);
    instructions.push(StakePoolInstruction.depositStake({
        stakePool: stakePoolAddress,
        validatorList: stakePool.account.data.validatorList,
        depositAuthority: stakePool.account.data.stakeDepositAuthority,
        reserveStake: stakePool.account.data.reserveStake,
        managerFeeAccount: stakePool.account.data.managerFeeAccount,
        referralPoolAccount: poolTokenReceiverAccount,
        destinationPoolAccount: poolTokenReceiverAccount,
        withdrawAuthority,
        depositStake,
        validatorStake,
        poolMint,
    }));
    return {
        instructions,
        signers,
        rentFee,
    };
}
/**
 * Creates instructions required to deposit sol to stake pool.
 */
async function depositSol(connection, stakePoolAddress, from, lamports, destinationTokenAccount, referrerTokenAccount, depositAuthority) {
    const fromBalance = await connection.getBalance(from, 'confirmed');
    if (fromBalance < lamports) {
        throw new Error(`Not enough SOL to deposit into pool. Maximum deposit amount is ${lamportsToSol(fromBalance)} SOL.`);
    }
    const stakePoolAccount = await getStakePoolAccount(connection, stakePoolAddress);
    const stakePool = stakePoolAccount.account.data;
    // Ephemeral SOL account just to do the transfer
    const userSolTransfer = new web3_js.Keypair();
    const signers = [userSolTransfer];
    const instructions = [];
    let rentFee = 0;
    // Create the ephemeral SOL account
    instructions.push(web3_js.SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: userSolTransfer.publicKey,
        lamports,
    }));
    // Create token account if not specified
    if (!destinationTokenAccount) {
        destinationTokenAccount = await addAssociatedTokenAccount(connection, from, stakePool.poolMint, instructions);
        if (instructions.length > 1) {
            rentFee = await connection.getMinimumBalanceForRentExemption(STAKE_STATE_LEN);
        }
    }
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    instructions.push(StakePoolInstruction.depositSol({
        stakePool: stakePoolAddress,
        reserveStake: stakePool.reserveStake,
        fundingAccount: userSolTransfer.publicKey,
        destinationPoolAccount: destinationTokenAccount,
        managerFeeAccount: stakePool.managerFeeAccount,
        referralPoolAccount: referrerTokenAccount !== null && referrerTokenAccount !== void 0 ? referrerTokenAccount : destinationTokenAccount,
        poolMint: stakePool.poolMint,
        lamports,
        withdrawAuthority,
        depositAuthority,
    }));
    return {
        instructions,
        signers,
        rentFee,
    };
}
/**
 * Creates instructions required to withdraw stake from a stake pool.
 */
async function withdrawStake(connection, stakePoolAddress, tokenOwner, amount, useReserve = false, voteAccountAddress, stakeReceiver, poolTokenAccount, validatorComparator) {
    var _c, _d;
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const poolAmount = solToLamports(amount);
    if (!poolTokenAccount) {
        poolTokenAccount = await splToken.Token.getAssociatedTokenAddress(splToken.ASSOCIATED_TOKEN_PROGRAM_ID, splToken.TOKEN_PROGRAM_ID, stakePool.account.data.poolMint, tokenOwner);
    }
    const tokenAccount = await getTokenAccount(connection, poolTokenAccount, stakePool.account.data.poolMint);
    if (!tokenAccount) {
        throw new Error('Invalid token account');
    }
    // Check withdrawFrom balance
    if (tokenAccount.amount.toNumber() < poolAmount) {
        throw new Error(`Not enough token balance to withdraw ${lamportsToSol(poolAmount)} pool tokens.
        Maximum withdraw amount is ${lamportsToSol(tokenAccount.amount.toNumber())} pool tokens.`);
    }
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const withdrawAccounts = [];
    if (useReserve) {
        withdrawAccounts.push({
            stakeAddress: stakePool.account.data.reserveStake,
            voteAddress: undefined,
            poolAmount,
        });
    }
    else if (voteAccountAddress) {
        const stakeAccountAddress = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, voteAccountAddress, stakePoolAddress);
        const stakeAccount = await connection.getAccountInfo(stakeAccountAddress);
        if (!stakeAccount) {
            throw new Error('Invalid Stake Account');
        }
        const availableForWithdrawal = calcLamportsWithdrawAmount(stakePool.account.data, stakeAccount.lamports - MIN_STAKE_BALANCE);
        if (availableForWithdrawal < poolAmount) {
            // noinspection ExceptionCaughtLocallyJS
            throw new Error(`Not enough lamports available for withdrawal from ${stakeAccountAddress},
          ${poolAmount} asked, ${availableForWithdrawal} available.`);
        }
        withdrawAccounts.push({
            stakeAddress: stakeAccountAddress,
            voteAddress: voteAccountAddress,
            poolAmount,
        });
    }
    else {
        // Get the list of accounts to withdraw from
        withdrawAccounts.push(...(await prepareWithdrawAccounts(connection, stakePool.account.data, stakePoolAddress, poolAmount, validatorComparator)));
    }
    // Construct transaction to withdraw from withdrawAccounts account list
    const instructions = [];
    const userTransferAuthority = web3_js.Keypair.generate();
    const signers = [userTransferAuthority];
    instructions.push(splToken.Token.createApproveInstruction(splToken.TOKEN_PROGRAM_ID, poolTokenAccount, userTransferAuthority.publicKey, tokenOwner, [], poolAmount));
    let totalRentFreeBalances = 0;
    // Max 5 accounts to prevent an error: "Transaction too large"
    const maxWithdrawAccounts = 5;
    let i = 0;
    // Go through prepared accounts and withdraw/claim them
    for (const withdrawAccount of withdrawAccounts) {
        if (i > maxWithdrawAccounts) {
            break;
        }
        // Convert pool tokens amount to lamports
        const solWithdrawAmount = Math.ceil(calcLamportsWithdrawAmount(stakePool.account.data, withdrawAccount.poolAmount));
        let infoMsg = `Withdrawing ◎${solWithdrawAmount},
      from stake account ${(_c = withdrawAccount.stakeAddress) === null || _c === void 0 ? void 0 : _c.toBase58()}`;
        if (withdrawAccount.voteAddress) {
            infoMsg = `${infoMsg}, delegated to ${(_d = withdrawAccount.voteAddress) === null || _d === void 0 ? void 0 : _d.toBase58()}`;
        }
        console.info(infoMsg);
        let stakeToReceive;
        // Use separate mutable variable because withdraw might create a new account
        if (!stakeReceiver) {
            const stakeReceiverAccountBalance = await connection.getMinimumBalanceForRentExemption(web3_js.StakeProgram.space);
            const stakeKeypair = newStakeAccount(tokenOwner, instructions, stakeReceiverAccountBalance);
            signers.push(stakeKeypair);
            totalRentFreeBalances += stakeReceiverAccountBalance;
            stakeToReceive = stakeKeypair.publicKey;
        }
        else {
            stakeToReceive = stakeReceiver;
        }
        instructions.push(StakePoolInstruction.withdrawStake({
            stakePool: stakePoolAddress,
            validatorList: stakePool.account.data.validatorList,
            validatorStake: withdrawAccount.stakeAddress,
            destinationStake: stakeToReceive,
            destinationStakeAuthority: tokenOwner,
            sourceTransferAuthority: userTransferAuthority.publicKey,
            sourcePoolAccount: poolTokenAccount,
            managerFeeAccount: stakePool.account.data.managerFeeAccount,
            poolMint: stakePool.account.data.poolMint,
            poolTokens: withdrawAccount.poolAmount,
            withdrawAuthority,
        }));
        i++;
    }
    return {
        instructions,
        signers,
        stakeReceiver,
        totalRentFreeBalances,
    };
}
/**
 * Creates instructions required to withdraw SOL directly from a stake pool.
 */
async function withdrawSol(connection, stakePoolAddress, tokenOwner, solReceiver, amount, solWithdrawAuthority) {
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const poolAmount = solToLamports(amount);
    const poolTokenAccount = await splToken.Token.getAssociatedTokenAddress(splToken.ASSOCIATED_TOKEN_PROGRAM_ID, splToken.TOKEN_PROGRAM_ID, stakePool.account.data.poolMint, tokenOwner);
    const tokenAccount = await getTokenAccount(connection, poolTokenAccount, stakePool.account.data.poolMint);
    if (!tokenAccount) {
        throw new Error('Invalid token account');
    }
    // Check withdrawFrom balance
    if (tokenAccount.amount.toNumber() < poolAmount) {
        throw new Error(`Not enough token balance to withdraw ${lamportsToSol(poolAmount)} pool tokens.
          Maximum withdraw amount is ${lamportsToSol(tokenAccount.amount.toNumber())} pool tokens.`);
    }
    // Construct transaction to withdraw from withdrawAccounts account list
    const instructions = [];
    const userTransferAuthority = web3_js.Keypair.generate();
    const signers = [userTransferAuthority];
    instructions.push(splToken.Token.createApproveInstruction(splToken.TOKEN_PROGRAM_ID, poolTokenAccount, userTransferAuthority.publicKey, tokenOwner, [], poolAmount));
    const poolWithdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    if (solWithdrawAuthority) {
        const expectedSolWithdrawAuthority = stakePool.account.data.solWithdrawAuthority;
        if (!expectedSolWithdrawAuthority) {
            throw new Error('SOL withdraw authority specified in arguments but stake pool has none');
        }
        if (solWithdrawAuthority.toBase58() != expectedSolWithdrawAuthority.toBase58()) {
            throw new Error(`Invalid deposit withdraw specified, expected ${expectedSolWithdrawAuthority.toBase58()}, received ${solWithdrawAuthority.toBase58()}`);
        }
    }
    const withdrawTransaction = StakePoolInstruction.withdrawSol({
        stakePool: stakePoolAddress,
        withdrawAuthority: poolWithdrawAuthority,
        reserveStake: stakePool.account.data.reserveStake,
        sourcePoolAccount: poolTokenAccount,
        sourceTransferAuthority: userTransferAuthority.publicKey,
        destinationSystemAccount: solReceiver,
        managerFeeAccount: stakePool.account.data.managerFeeAccount,
        poolMint: stakePool.account.data.poolMint,
        poolTokens: poolAmount,
        solWithdrawAuthority,
    });
    instructions.push(withdrawTransaction);
    return {
        instructions,
        signers,
    };
}
/**
 * Creates instructions required to increase validator stake.
 */
async function increaseValidatorStake(connection, stakePoolAddress, validatorVote, lamports) {
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const validatorList = await getValidatorListAccount(connection, stakePool.account.data.validatorList);
    const validatorInfo = validatorList.account.data.validators.find(v => v.voteAccountAddress.toBase58() == validatorVote.toBase58());
    if (!validatorInfo) {
        throw new Error('Vote account not found in validator list');
    }
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const transientStakeSeed = validatorInfo.transientSeedSuffixStart.addn(1); // bump up by one to avoid reuse
    const transientStake = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorInfo.voteAccountAddress, stakePoolAddress, transientStakeSeed);
    const instructions = [];
    instructions.push(StakePoolInstruction.increaseValidatorStake({
        stakePool: stakePoolAddress,
        staker: stakePool.account.data.staker,
        validatorList: stakePool.account.data.validatorList,
        reserveStake: stakePool.account.data.reserveStake,
        transientStakeSeed: transientStakeSeed.toNumber(),
        withdrawAuthority,
        transientStake,
        validatorVote,
        lamports,
    }));
    return {
        instructions,
    };
}
/**
 * Creates instructions required to decrease validator stake.
 */
async function decreaseValidatorStake(connection, stakePoolAddress, validatorVote, lamports) {
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const validatorList = await getValidatorListAccount(connection, stakePool.account.data.validatorList);
    const validatorInfo = validatorList.account.data.validators.find(v => v.voteAccountAddress.toBase58() == validatorVote.toBase58());
    if (!validatorInfo) {
        throw new Error('Vote account not found in validator list');
    }
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const validatorStake = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorInfo.voteAccountAddress, stakePoolAddress);
    const transientStakeSeed = validatorInfo.transientSeedSuffixStart.addn(1); // bump up by one to avoid reuse
    const transientStake = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorInfo.voteAccountAddress, stakePoolAddress, transientStakeSeed);
    const instructions = [];
    instructions.push(StakePoolInstruction.decreaseValidatorStake({
        stakePool: stakePoolAddress,
        staker: stakePool.account.data.staker,
        validatorList: stakePool.account.data.validatorList,
        transientStakeSeed: transientStakeSeed.toNumber(),
        withdrawAuthority,
        validatorStake,
        transientStake,
        lamports,
    }));
    return {
        instructions,
    };
}
/**
 * Creates instructions required to completely update a stake pool after epoch change.
 */
async function updateStakePool(connection, stakePool, noMerge = false) {
    // const stakePool = await getStakePoolAccount(connection, stakePoolAddress)
    const stakePoolAddress = stakePool.pubkey;
    const validatorList = await getValidatorListAccount(connection, stakePool.account.data.validatorList);
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const updateListInstructions = [];
    const instructions = [];
    let startIndex = 0;
    const validatorChunks = arrayChunk(validatorList.account.data.validators, MAX_VALIDATORS_TO_UPDATE);
    for (const validatorChunk of validatorChunks) {
        const validatorAndTransientStakePairs = [];
        for (const validator of validatorChunk) {
            const validatorStake = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validator.voteAccountAddress, stakePoolAddress);
            validatorAndTransientStakePairs.push(validatorStake);
            const transientStake = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validator.voteAccountAddress, stakePoolAddress, validator.transientSeedSuffixStart);
            validatorAndTransientStakePairs.push(transientStake);
        }
        updateListInstructions.push(StakePoolInstruction.updateValidatorListBalance({
            stakePool: stakePoolAddress,
            validatorList: stakePool.account.data.validatorList,
            reserveStake: stakePool.account.data.reserveStake,
            validatorAndTransientStakePairs,
            withdrawAuthority,
            startIndex,
            noMerge,
        }));
        startIndex += MAX_VALIDATORS_TO_UPDATE;
    }
    instructions.push(StakePoolInstruction.updateStakePoolBalance({
        stakePool: stakePoolAddress,
        validatorList: stakePool.account.data.validatorList,
        reserveStake: stakePool.account.data.reserveStake,
        managerFeeAccount: stakePool.account.data.managerFeeAccount,
        poolMint: stakePool.account.data.poolMint,
        withdrawAuthority,
    }));
    instructions.push(StakePoolInstruction.cleanupRemovedValidatorEntries({
        stakePool: stakePoolAddress,
        validatorList: stakePool.account.data.validatorList,
    }));
    return {
        updateListInstructions,
        finalInstructions: instructions,
    };
}
/**
 * Retrieves detailed information about the StakePool.
 */
async function stakePoolInfo(connection, stakePoolAddress) {
    var _c, _d;
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const reserveAccountStakeAddress = stakePool.account.data.reserveStake;
    const totalLamports = stakePool.account.lamports;
    const lastUpdateEpoch = stakePool.account.data.lastUpdateEpoch;
    const validatorList = await getValidatorListAccount(connection, stakePool.account.data.validatorList);
    const maxNumberOfValidators = validatorList.account.data.maxValidators;
    const currentNumberOfValidators = validatorList.account.data.validators.length;
    const epochInfo = await connection.getEpochInfo();
    const reserveStake = await connection.getAccountInfo(reserveAccountStakeAddress);
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const minimumReserveStakeBalance = (await connection.getMinimumBalanceForRentExemption(STAKE_STATE_LEN)) + 1;
    const stakeAccounts = await Promise.all(validatorList.account.data.validators.map(async (validator) => {
        const stakeAccountAddress = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validator.voteAccountAddress, stakePoolAddress);
        const transientStakeAccountAddress = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validator.voteAccountAddress, stakePoolAddress, validator.transientSeedSuffixStart);
        const updateRequired = !validator.lastUpdateEpoch.eqn(epochInfo.epoch);
        return {
            voteAccountAddress: validator.voteAccountAddress.toBase58(),
            stakeAccountAddress: stakeAccountAddress.toBase58(),
            validatorActiveStakeLamports: validator.activeStakeLamports.toString(),
            validatorLastUpdateEpoch: validator.lastUpdateEpoch.toString(),
            validatorLamports: validator.activeStakeLamports
                .add(validator.transientStakeLamports)
                .toString(),
            validatorTransientStakeAccountAddress: transientStakeAccountAddress.toBase58(),
            validatorTransientStakeLamports: validator.transientStakeLamports.toString(),
            updateRequired,
        };
    }));
    const totalPoolTokens = lamportsToSol(stakePool.account.data.poolTokenSupply);
    const updateRequired = !lastUpdateEpoch.eqn(epochInfo.epoch);
    return {
        address: stakePoolAddress.toBase58(),
        poolWithdrawAuthority: withdrawAuthority.toBase58(),
        manager: stakePool.account.data.manager.toBase58(),
        staker: stakePool.account.data.staker.toBase58(),
        stakeDepositAuthority: stakePool.account.data.stakeDepositAuthority.toBase58(),
        stakeWithdrawBumpSeed: stakePool.account.data.stakeWithdrawBumpSeed,
        maxValidators: maxNumberOfValidators,
        validatorList: validatorList.account.data.validators.map(validator => {
            return {
                activeStakeLamports: validator.activeStakeLamports.toString(),
                transientStakeLamports: validator.transientStakeLamports.toString(),
                lastUpdateEpoch: validator.lastUpdateEpoch.toString(),
                transientSeedSuffixStart: validator.transientSeedSuffixStart.toString(),
                transientSeedSuffixEnd: validator.transientSeedSuffixEnd.toString(),
                status: validator.status.toString(),
                voteAccountAddress: validator.voteAccountAddress.toString(),
            };
        }),
        validatorListStorageAccount: stakePool.account.data.validatorList.toBase58(),
        reserveStake: stakePool.account.data.reserveStake.toBase58(),
        poolMint: stakePool.account.data.poolMint.toBase58(),
        managerFeeAccount: stakePool.account.data.managerFeeAccount.toBase58(),
        tokenProgramId: stakePool.account.data.tokenProgramId.toBase58(),
        totalLamports: stakePool.account.data.totalLamports.toString(),
        poolTokenSupply: stakePool.account.data.poolTokenSupply.toString(),
        lastUpdateEpoch: stakePool.account.data.lastUpdateEpoch.toString(),
        lockup: stakePool.account.data.lockup,
        epochFee: stakePool.account.data.epochFee,
        nextEpochFee: stakePool.account.data.nextEpochFee,
        preferredDepositValidatorVoteAddress: stakePool.account.data.preferredDepositValidatorVoteAddress,
        preferredWithdrawValidatorVoteAddress: stakePool.account.data.preferredWithdrawValidatorVoteAddress,
        stakeDepositFee: stakePool.account.data.stakeDepositFee,
        stakeWithdrawalFee: stakePool.account.data.stakeWithdrawalFee,
        // CliStakePool the same
        nextStakeWithdrawalFee: stakePool.account.data.nextSolWithdrawalFee,
        stakeReferralFee: stakePool.account.data.stakeReferralFee,
        solDepositAuthority: (_c = stakePool.account.data.solDepositAuthority) === null || _c === void 0 ? void 0 : _c.toBase58(),
        solDepositFee: stakePool.account.data.solDepositFee,
        solReferralFee: stakePool.account.data.solReferralFee,
        solWithdrawAuthority: (_d = stakePool.account.data.solWithdrawAuthority) === null || _d === void 0 ? void 0 : _d.toBase58(),
        solWithdrawalFee: stakePool.account.data.solWithdrawalFee,
        nextSolWithdrawalFee: stakePool.account.data.nextSolWithdrawalFee,
        lastEpochPoolTokenSupply: stakePool.account.data.lastEpochPoolTokenSupply.toString(),
        lastEpochTotalLamports: stakePool.account.data.lastEpochTotalLamports.toString(),
        details: {
            reserveStakeLamports: reserveStake === null || reserveStake === void 0 ? void 0 : reserveStake.lamports,
            reserveAccountStakeAddress: reserveAccountStakeAddress.toBase58(),
            minimumReserveStakeBalance,
            stakeAccounts,
            totalLamports,
            totalPoolTokens,
            currentNumberOfValidators,
            maxNumberOfValidators,
            updateRequired,
        }, // CliStakePoolDetails
    };
}

exports.STAKE_POOL_INSTRUCTION_LAYOUTS = STAKE_POOL_INSTRUCTION_LAYOUTS;
exports.STAKE_POOL_PROGRAM_ID = STAKE_POOL_PROGRAM_ID;
exports.StakePoolInstruction = StakePoolInstruction;
exports.decreaseValidatorStake = decreaseValidatorStake;
exports.depositSol = depositSol;
exports.depositStake = depositStake;
exports.getStakePoolAccount = getStakePoolAccount;
exports.getStakePoolAccounts = getStakePoolAccounts;
exports.increaseValidatorStake = increaseValidatorStake;
exports.stakePoolInfo = stakePoolInfo;
exports.updateStakePool = updateStakePool;
exports.withdrawSol = withdrawSol;
exports.withdrawStake = withdrawStake;
//# sourceMappingURL=index.cjs.js.map
