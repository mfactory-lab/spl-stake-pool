import { Keypair, StakeProgram, SystemProgram, } from '@solana/web3.js';
import { findStakeProgramAddress, findTransientStakeProgramAddress } from './program-address';
import BN from 'bn.js';
import { lamportsToSol } from './math';
import { ValidatorListLayout, ValidatorStakeInfoStatus, } from '../layouts';
import { MINIMUM_ACTIVE_STAKE, MINIMUM_RESERVE_LAMPORTS, STAKE_POOL_PROGRAM_ID, } from '../constants';
export async function getValidatorListAccount(connection, pubkey) {
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
export async function prepareWithdrawAccounts(connection, stakePool, stakePoolAddress, amount, compareFn, skipFee) {
    var _a, _b;
    const validatorListAcc = await connection.getAccountInfo(stakePool.validatorList);
    const validatorList = ValidatorListLayout.decode(validatorListAcc === null || validatorListAcc === void 0 ? void 0 : validatorListAcc.data);
    if (!(validatorList === null || validatorList === void 0 ? void 0 : validatorList.validators) || (validatorList === null || validatorList === void 0 ? void 0 : validatorList.validators.length) == 0) {
        throw new Error('No accounts found');
    }
    const minBalanceForRentExemption = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);
    const minBalance = minBalanceForRentExemption + MINIMUM_ACTIVE_STAKE;
    let accounts = [];
    // Prepare accounts
    for (const validator of validatorList.validators) {
        if (validator.status !== ValidatorStakeInfoStatus.Active) {
            continue;
        }
        const stakeAccountAddress = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validator.voteAccountAddress, stakePoolAddress);
        const isPreferred = (_a = stakePool === null || stakePool === void 0 ? void 0 : stakePool.preferredWithdrawValidatorVoteAddress) === null || _a === void 0 ? void 0 : _a.equals(validator.voteAccountAddress);
        if (!validator.activeStakeLamports.isZero()) {
            accounts.push({
                type: isPreferred ? 'preferred' : 'active',
                voteAddress: validator.voteAccountAddress,
                stakeAddress: stakeAccountAddress,
                lamports: validator.activeStakeLamports.toNumber(),
            });
            continue;
        }
        const transientStakeLamports = validator.transientStakeLamports.toNumber() - minBalance;
        if (transientStakeLamports > 0) {
            const transientStakeAccountAddress = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validator.voteAccountAddress, stakePoolAddress, validator.transientSeedSuffixStart);
            accounts.push({
                type: isPreferred ? 'preferred' : 'transient',
                voteAddress: validator.voteAccountAddress,
                stakeAddress: transientStakeAccountAddress,
                lamports: transientStakeLamports,
            });
        }
    }
    // Sort from highest to lowest balance
    accounts = accounts.sort(compareFn ? compareFn : (a, b) => b.lamports - a.lamports);
    const reserveStake = await connection.getAccountInfo(stakePool.reserveStake);
    const reserveStakeBalance = ((_b = reserveStake === null || reserveStake === void 0 ? void 0 : reserveStake.lamports) !== null && _b !== void 0 ? _b : 0) - minBalanceForRentExemption - MINIMUM_RESERVE_LAMPORTS;
    if (reserveStakeBalance > 0) {
        accounts.push({
            type: 'reserve',
            stakeAddress: stakePool.reserveStake,
            lamports: reserveStakeBalance,
        });
    }
    // Prepare the list of accounts to withdraw from
    const withdrawFrom = [];
    let remainingAmount = amount;
    const fee = stakePool.stakeWithdrawalFee;
    const inverseFee = {
        numerator: fee.denominator.sub(fee.numerator),
        denominator: fee.denominator,
    };
    for (const type of ['preferred', 'active', 'transient', 'reserve']) {
        const filteredAccounts = accounts.filter((a) => a.type == type);
        for (const { stakeAddress, voteAddress, lamports } of filteredAccounts) {
            if (lamports <= minBalance && type == 'transient') {
                continue;
            }
            let availableForWithdrawal = calcPoolTokensForDeposit(stakePool, lamports);
            if (!skipFee && !inverseFee.numerator.isZero()) {
                availableForWithdrawal = divideBnToNumber(new BN(availableForWithdrawal).mul(inverseFee.denominator), inverseFee.numerator);
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
export function calcPoolTokensForDeposit(stakePool, stakeLamports) {
    if (stakePool.poolTokenSupply.isZero() || stakePool.totalLamports.isZero()) {
        return stakeLamports;
    }
    return Math.floor(divideBnToNumber(new BN(stakeLamports).mul(stakePool.poolTokenSupply), stakePool.totalLamports));
}
/**
 * Calculate lamports amount on withdrawal
 */
export function calcLamportsWithdrawAmount(stakePool, poolTokens) {
    const numerator = new BN(poolTokens).mul(stakePool.totalLamports);
    const denominator = stakePool.poolTokenSupply;
    if (numerator.lt(denominator)) {
        return 0;
    }
    return divideBnToNumber(numerator, denominator);
}
export function divideBnToNumber(numerator, denominator) {
    if (denominator.isZero()) {
        return 0;
    }
    const quotient = numerator.div(denominator).toNumber();
    const rem = numerator.umod(denominator);
    const gcd = rem.gcd(denominator);
    return quotient + rem.div(gcd).toNumber() / denominator.div(gcd).toNumber();
}
export function newStakeAccount(feePayer, instructions, lamports) {
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
    }));
    return stakeReceiverKeypair;
}
