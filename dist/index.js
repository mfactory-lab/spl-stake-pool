import { Keypair, PublicKey, StakeAuthorizationLayout, StakeProgram, SystemProgram, } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { create } from 'superstruct';
import BN from 'bn.js';
import { addAssociatedTokenAccount, arrayChunk, calcLamportsWithdrawAmount, findEphemeralStakeProgramAddress, findStakeProgramAddress, findTransientStakeProgramAddress, findWithdrawAuthorityProgramAddress, getTokenAccount, getValidatorListAccount, lamportsToSol, newStakeAccount, prepareWithdrawAccounts, solToLamports, getMetadataPDA, } from './utils';
import { StakePoolInstruction } from './instructions';
import { StakeAccount, StakePoolLayout, ValidatorListLayout, ValidatorStakeInfoLayout, } from './layouts';
import { MAX_VALIDATORS_TO_UPDATE, MINIMUM_ACTIVE_STAKE, STAKE_POOL_PROGRAM_ID } from './constants';
export { STAKE_POOL_PROGRAM_ID } from './constants';
export * from './instructions';
/**
 * Retrieves and deserializes a StakePool account using a web3js connection and the stake pool address.
 * @param connection: An active web3js connection.
 * @param stakePoolAddress: The public key (address) of the stake pool account.
 */
export async function getStakePoolAccount(connection, stakePoolAddress) {
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
 * Retrieves and deserializes a Stake account using a web3js connection and the stake address.
 * @param connection: An active web3js connection.
 * @param stakeAccount: The public key (address) of the stake account.
 */
export async function getStakeAccount(connection, stakeAccount) {
    const result = (await connection.getParsedAccountInfo(stakeAccount)).value;
    if (!result || !('parsed' in result.data)) {
        throw new Error('Invalid stake account');
    }
    const program = result.data.program;
    if (program != 'stake') {
        throw new Error('Not a stake account');
    }
    return create(result.data.parsed, StakeAccount);
}
/**
 * Retrieves all StakePool and ValidatorList accounts that are running a particular StakePool program.
 * @param connection: An active web3js connection.
 * @param stakePoolProgramAddress: The public key (address) of the StakePool program.
 */
export async function getStakePoolAccounts(connection, stakePoolProgramAddress) {
    const response = await connection.getProgramAccounts(stakePoolProgramAddress);
    return response.map((a) => {
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
export async function depositStake(connection, stakePoolAddress, authorizedPubkey, validatorVote, depositStake, poolTokenReceiverAccount) {
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const validatorStake = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorVote, stakePoolAddress);
    const instructions = [];
    const signers = [];
    const poolMint = stakePool.account.data.poolMint;
    let rentFee = 0;
    // Create token account if not specified
    if (!poolTokenReceiverAccount) {
        const { associatedAddress, rentFee: fee } = await addAssociatedTokenAccount(connection, authorizedPubkey, poolMint, instructions);
        poolTokenReceiverAccount = associatedAddress;
        rentFee += fee;
    }
    instructions.push(...StakeProgram.authorize({
        stakePubkey: depositStake,
        authorizedPubkey,
        newAuthorizedPubkey: stakePool.account.data.stakeDepositAuthority,
        stakeAuthorizationType: StakeAuthorizationLayout.Staker,
    }).instructions);
    instructions.push(...StakeProgram.authorize({
        stakePubkey: depositStake,
        authorizedPubkey,
        newAuthorizedPubkey: stakePool.account.data.stakeDepositAuthority,
        stakeAuthorizationType: StakeAuthorizationLayout.Withdrawer,
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
export async function depositSol(connection, stakePoolAddress, from, lamports, destinationTokenAccount, referrerTokenAccount, depositAuthority) {
    const fromBalance = await connection.getBalance(from, 'confirmed');
    if (fromBalance < lamports) {
        throw new Error(`Not enough SOL to deposit into pool. Maximum deposit amount is ${lamportsToSol(fromBalance)} SOL.`);
    }
    const stakePoolAccount = await getStakePoolAccount(connection, stakePoolAddress);
    const stakePool = stakePoolAccount.account.data;
    // Ephemeral SOL account just to do the transfer
    const userSolTransfer = new Keypair();
    const signers = [userSolTransfer];
    const instructions = [];
    let rentFee = 0;
    // Create the ephemeral SOL account
    instructions.push(SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: userSolTransfer.publicKey,
        lamports,
    }));
    // Create token account if not specified
    if (!destinationTokenAccount) {
        const { associatedAddress, rentFee: fee } = await addAssociatedTokenAccount(connection, from, stakePool.poolMint, instructions);
        destinationTokenAccount = associatedAddress;
        rentFee += fee;
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
export async function withdrawStake(connection, stakePoolAddress, tokenOwner, amount, useReserve = false, voteAccountAddress, stakeReceiver, poolTokenAccount, validatorComparator) {
    var _c, _d, _e, _f;
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const poolAmount = solToLamports(amount);
    if (!poolTokenAccount) {
        poolTokenAccount = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, stakePool.account.data.poolMint, tokenOwner);
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
    const stakeAccountRentExemption = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    let stakeReceiverAccount = null;
    if (stakeReceiver) {
        stakeReceiverAccount = await getStakeAccount(connection, stakeReceiver);
    }
    const withdrawAccounts = [];
    if (useReserve) {
        withdrawAccounts.push({
            stakeAddress: stakePool.account.data.reserveStake,
            voteAddress: undefined,
            poolAmount,
        });
    }
    else if (stakeReceiverAccount && (stakeReceiverAccount === null || stakeReceiverAccount === void 0 ? void 0 : stakeReceiverAccount.type) == 'delegated') {
        const voteAccount = (_d = (_c = stakeReceiverAccount.info) === null || _c === void 0 ? void 0 : _c.stake) === null || _d === void 0 ? void 0 : _d.delegation.voter;
        if (!voteAccount)
            throw new Error(`Invalid stake reciever ${stakeReceiver} delegation`);
        const validatorListAccount = await connection.getAccountInfo(stakePool.account.data.validatorList);
        const validatorList = ValidatorListLayout.decode(validatorListAccount === null || validatorListAccount === void 0 ? void 0 : validatorListAccount.data);
        const isValidVoter = validatorList.validators.find((val) => val.voteAccountAddress.equals(voteAccount));
        if (voteAccountAddress && voteAccountAddress !== voteAccount) {
            throw new Error(`Provided withdrawal vote account ${voteAccountAddress} does not match delegation on stake receiver account ${voteAccount},
      remove this flag or provide a different stake account delegated to ${voteAccountAddress}`);
        }
        if (isValidVoter) {
            const stakeAccountAddress = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, voteAccount, stakePoolAddress);
            const stakeAccount = await connection.getAccountInfo(stakeAccountAddress);
            if (!stakeAccount) {
                throw new Error(`Preferred withdraw valdator's stake account is invalid`);
            }
            const availableForWithdrawal = calcLamportsWithdrawAmount(stakePool.account.data, stakeAccount.lamports - MINIMUM_ACTIVE_STAKE - stakeAccountRentExemption);
            if (availableForWithdrawal < poolAmount) {
                throw new Error(`Not enough lamports available for withdrawal from ${stakeAccountAddress},
            ${poolAmount} asked, ${availableForWithdrawal} available.`);
            }
            withdrawAccounts.push({
                stakeAddress: stakeAccountAddress,
                voteAddress: voteAccount,
                poolAmount,
            });
        }
        else {
            throw new Error(`Provided stake account is delegated to a vote account ${voteAccount} which does not exist in the stake pool`);
        }
    }
    else if (voteAccountAddress) {
        const stakeAccountAddress = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, voteAccountAddress, stakePoolAddress);
        const stakeAccount = await connection.getAccountInfo(stakeAccountAddress);
        if (!stakeAccount) {
            throw new Error('Invalid Stake Account');
        }
        const availableForWithdrawal = calcLamportsWithdrawAmount(stakePool.account.data, stakeAccount.lamports - MINIMUM_ACTIVE_STAKE - stakeAccountRentExemption);
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
        withdrawAccounts.push(...(await prepareWithdrawAccounts(connection, stakePool.account.data, stakePoolAddress, poolAmount, validatorComparator, poolTokenAccount.equals(stakePool.account.data.managerFeeAccount))));
    }
    // Construct transaction to withdraw from withdrawAccounts account list
    const instructions = [];
    const userTransferAuthority = Keypair.generate();
    const signers = [userTransferAuthority];
    instructions.push(Token.createApproveInstruction(TOKEN_PROGRAM_ID, poolTokenAccount, userTransferAuthority.publicKey, tokenOwner, [], poolAmount));
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
      from stake account ${(_e = withdrawAccount.stakeAddress) === null || _e === void 0 ? void 0 : _e.toBase58()}`;
        if (withdrawAccount.voteAddress) {
            infoMsg = `${infoMsg}, delegated to ${(_f = withdrawAccount.voteAddress) === null || _f === void 0 ? void 0 : _f.toBase58()}`;
        }
        console.info(infoMsg);
        let stakeToReceive;
        if (!stakeReceiver || (stakeReceiverAccount && stakeReceiverAccount.type === 'delegated')) {
            const stakeKeypair = newStakeAccount(tokenOwner, instructions, stakeAccountRentExemption);
            signers.push(stakeKeypair);
            totalRentFreeBalances += stakeAccountRentExemption;
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
    if (stakeReceiver && stakeReceiverAccount && stakeReceiverAccount.type === 'delegated') {
        signers.forEach((newStakeKeypair) => {
            instructions.concat(StakeProgram.merge({
                stakePubkey: stakeReceiver,
                sourceStakePubKey: newStakeKeypair.publicKey,
                authorizedPubkey: tokenOwner,
            }).instructions);
        });
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
export async function withdrawSol(connection, stakePoolAddress, tokenOwner, solReceiver, amount, solWithdrawAuthority) {
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const poolAmount = solToLamports(amount);
    const poolTokenAccount = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, stakePool.account.data.poolMint, tokenOwner);
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
    const userTransferAuthority = Keypair.generate();
    const signers = [userTransferAuthority];
    instructions.push(Token.createApproveInstruction(TOKEN_PROGRAM_ID, poolTokenAccount, userTransferAuthority.publicKey, tokenOwner, [], poolAmount));
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
export async function increaseValidatorStake(connection, stakePoolAddress, validatorVote, lamports, ephemeralStakeSeed) {
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const validatorList = await getValidatorListAccount(connection, stakePool.account.data.validatorList);
    const validatorInfo = validatorList.account.data.validators.find((v) => v.voteAccountAddress.toBase58() == validatorVote.toBase58());
    if (!validatorInfo) {
        throw new Error('Vote account not found in validator list');
    }
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const transientStakeSeed = validatorInfo.transientSeedSuffixStart.addn(1); // bump up by one to avoid reuse
    const transientStake = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorInfo.voteAccountAddress, stakePoolAddress, transientStakeSeed);
    const validatorStake = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorInfo.voteAccountAddress, stakePoolAddress);
    const instructions = [];
    if (ephemeralStakeSeed != undefined) {
        const ephemeralStake = await findEphemeralStakeProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress, new BN(ephemeralStakeSeed));
        StakePoolInstruction.increaseAdditionalValidatorStake({
            stakePool: stakePoolAddress,
            staker: stakePool.account.data.staker,
            validatorList: stakePool.account.data.validatorList,
            reserveStake: stakePool.account.data.reserveStake,
            transientStakeSeed: transientStakeSeed.toNumber(),
            withdrawAuthority,
            transientStake,
            validatorStake,
            validatorVote,
            lamports,
            ephemeralStake,
            ephemeralStakeSeed,
        });
    }
    else {
        instructions.push(StakePoolInstruction.increaseValidatorStake({
            stakePool: stakePoolAddress,
            staker: stakePool.account.data.staker,
            validatorList: stakePool.account.data.validatorList,
            reserveStake: stakePool.account.data.reserveStake,
            transientStakeSeed: transientStakeSeed.toNumber(),
            withdrawAuthority,
            transientStake,
            validatorStake,
            validatorVote,
            lamports,
        }));
    }
    return {
        instructions,
    };
}
/**
 * Creates instructions required to decrease validator stake.
 */
export async function decreaseValidatorStake(connection, stakePoolAddress, validatorVote, lamports, ephemeralStakeSeed) {
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const validatorList = await getValidatorListAccount(connection, stakePool.account.data.validatorList);
    const validatorInfo = validatorList.account.data.validators.find((v) => v.voteAccountAddress.toBase58() == validatorVote.toBase58());
    if (!validatorInfo) {
        throw new Error('Vote account not found in validator list');
    }
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const validatorStake = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorInfo.voteAccountAddress, stakePoolAddress);
    const transientStakeSeed = validatorInfo.transientSeedSuffixStart.addn(1); // bump up by one to avoid reuse
    const transientStake = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorInfo.voteAccountAddress, stakePoolAddress, transientStakeSeed);
    const instructions = [];
    if (ephemeralStakeSeed != undefined) {
        const ephemeralStake = await findEphemeralStakeProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress, new BN(ephemeralStakeSeed));
        instructions.push(StakePoolInstruction.decreaseAdditionalValidatorStake({
            stakePool: stakePoolAddress,
            staker: stakePool.account.data.staker,
            validatorList: stakePool.account.data.validatorList,
            transientStakeSeed: transientStakeSeed.toNumber(),
            withdrawAuthority,
            validatorStake,
            transientStake,
            lamports,
            ephemeralStake,
            ephemeralStakeSeed,
        }));
    }
    else {
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
    }
    return {
        instructions,
    };
}
/**
 * Creates instructions required to completely update a stake pool after epoch change.
 */
export async function updateStakePool(connection, stakePool, noMerge = false) {
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
export async function stakePoolInfo(connection, stakePoolAddress) {
    var _c, _d;
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const reserveAccountStakeAddress = stakePool.account.data.reserveStake;
    const totalLamports = stakePool.account.data.totalLamports;
    const lastUpdateEpoch = stakePool.account.data.lastUpdateEpoch;
    const validatorList = await getValidatorListAccount(connection, stakePool.account.data.validatorList);
    const maxNumberOfValidators = validatorList.account.data.maxValidators;
    const currentNumberOfValidators = validatorList.account.data.validators.length;
    const epochInfo = await connection.getEpochInfo();
    const reserveStake = await connection.getAccountInfo(reserveAccountStakeAddress);
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const minimumReserveStakeBalance = (await connection.getMinimumBalanceForRentExemption(StakeProgram.space)) + 1;
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
        validatorList: validatorList.account.data.validators.map((validator) => {
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
        nextStakeWithdrawalFee: stakePool.account.data.nextStakeWithdrawalFee,
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
/**
 * Creates instructions required to redelegate stake.
 */
export async function redelegate(props) {
    const { connection, stakePoolAddress, sourceVoteAccount, sourceTransientStakeSeed, destinationVoteAccount, destinationTransientStakeSeed, ephemeralStakeSeed, lamports, } = props;
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const stakePoolWithdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const sourceValidatorStake = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, sourceVoteAccount, stakePoolAddress);
    const sourceTransientStake = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, sourceVoteAccount, stakePoolAddress, new BN(sourceTransientStakeSeed));
    const destinationValidatorStake = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, destinationVoteAccount, stakePoolAddress);
    const destinationTransientStake = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, destinationVoteAccount, stakePoolAddress, new BN(destinationTransientStakeSeed));
    const ephemeralStake = await findEphemeralStakeProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress, new BN(ephemeralStakeSeed));
    const instructions = [];
    instructions.push(StakePoolInstruction.redelegate({
        stakePool: stakePool.pubkey,
        staker: stakePool.account.data.staker,
        validatorList: stakePool.account.data.validatorList,
        stakePoolWithdrawAuthority,
        ephemeralStake,
        ephemeralStakeSeed,
        sourceValidatorStake,
        sourceTransientStake,
        sourceTransientStakeSeed,
        destinationValidatorStake,
        destinationTransientStake,
        destinationTransientStakeSeed,
        validator: destinationVoteAccount,
        lamports,
    }));
    return {
        instructions,
    };
}
/**
 * Initializes a new StakePool.
 */
export async function initialize(props) {
    const { connection, stakePool, poolMint, validatorList, manager, reserveStake, managerPoolAccount, fee, referralFee, } = props;
    const poolBalance = await connection.getMinimumBalanceForRentExemption(StakePoolLayout.span);
    const instructions = [];
    const signers = [manager, stakePool, validatorList];
    instructions.push(SystemProgram.createAccount({
        fromPubkey: manager.publicKey,
        newAccountPubkey: stakePool.publicKey,
        lamports: poolBalance,
        space: StakePoolLayout.span,
        programId: STAKE_POOL_PROGRAM_ID,
    }));
    // current supported max by the program, go big!
    const maxValidators = 2950;
    const validatorListBalance = await connection.getMinimumBalanceForRentExemption(ValidatorListLayout.span + ValidatorStakeInfoLayout.span * maxValidators);
    instructions.push(SystemProgram.createAccount({
        fromPubkey: manager.publicKey,
        newAccountPubkey: validatorList.publicKey,
        lamports: validatorListBalance,
        space: ValidatorListLayout.span,
        programId: STAKE_POOL_PROGRAM_ID,
    }));
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePool.publicKey);
    instructions.push(StakePoolInstruction.initialize({
        stakePool: stakePool.publicKey,
        manager: manager.publicKey,
        staker: manager.publicKey,
        stakePoolWithdrawAuthority: withdrawAuthority,
        validatorList: validatorList.publicKey,
        poolMint,
        managerPoolAccount,
        reserveStake,
        fee,
        withdrawalFee: fee,
        depositFee: fee,
        referralFee,
        maxValidators,
    }));
    return {
        instructions,
        signers,
    };
}
/**
 * Creates instructions required to create pool token metadata.
 */
export async function createPoolTokenMetadata(props) {
    var _c;
    const { connection, name, symbol, uri, payer } = props;
    const stakePool = props.stakePool instanceof PublicKey
        ? await getStakePoolAccount(connection, props.stakePool)
        : props.stakePool;
    const tokenMetadata = (_c = props.tokenMetadata) !== null && _c !== void 0 ? _c : (await getMetadataPDA(stakePool.account.data.poolMint));
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePool.pubkey);
    const manager = stakePool.account.data.manager;
    const instructions = [];
    instructions.push(StakePoolInstruction.createTokenMetadata({
        stakePool: stakePool.pubkey,
        poolMint: stakePool.account.data.poolMint,
        payer,
        manager,
        tokenMetadata,
        withdrawAuthority,
        name,
        symbol,
        uri,
    }));
    return {
        instructions,
    };
}
/**
 * Creates instructions required to update pool token metadata.
 */
export async function updatePoolTokenMetadata(props) {
    var _c;
    const { connection, name, symbol, uri } = props;
    const stakePool = props.stakePool instanceof PublicKey
        ? await getStakePoolAccount(connection, props.stakePool)
        : props.stakePool;
    const tokenMetadata = (_c = props.tokenMetadata) !== null && _c !== void 0 ? _c : (await getMetadataPDA(stakePool.account.data.poolMint));
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePool.pubkey);
    const instructions = [];
    instructions.push(StakePoolInstruction.updateTokenMetadata({
        stakePool: stakePool.pubkey,
        manager: stakePool.account.data.manager,
        tokenMetadata,
        withdrawAuthority,
        name,
        symbol,
        uri,
    }));
    return {
        instructions,
    };
}
/**
 * Creates instructions required to add a validator to the pool.
 */
export async function addValidatorToPool(connection, stakePoolAddress, validatorVote, seed) {
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const validatorList = await getValidatorListAccount(connection, stakePool.account.data.validatorList);
    const validatorInfo = validatorList.account.data.validators.find((v) => v.voteAccountAddress.toBase58() == validatorVote.toBase58());
    if (validatorInfo) {
        throw new Error(`Stake pool already contains validator ${validatorInfo}, ignoring`);
    }
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const validatorStake = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorVote, stakePoolAddress);
    const instructions = [];
    instructions.push(StakePoolInstruction.addValidatorToPool({
        stakePool: stakePoolAddress,
        staker: stakePool.account.data.staker,
        validatorList: stakePool.account.data.validatorList,
        validatorStake,
        reserveStake: stakePool.account.data.reserveStake,
        withdrawAuthority,
        validatorVote,
        seed,
    }));
    return {
        instructions,
    };
}
/**
 * Creates instructions required to add a validator to the pool.
 */
export async function removeValidatorFromPool(connection, stakePoolAddress, validatorVote) {
    const stakePool = await getStakePoolAccount(connection, stakePoolAddress);
    const validatorList = await getValidatorListAccount(connection, stakePool.account.data.validatorList);
    const validatorInfo = validatorList.account.data.validators.find((v) => v.voteAccountAddress.toBase58() == validatorVote.toBase58());
    if (!validatorInfo) {
        throw new Error('Vote account not found in validator list');
    }
    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(STAKE_POOL_PROGRAM_ID, stakePoolAddress);
    const transientStake = await findTransientStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorInfo.voteAccountAddress, stakePoolAddress, validatorInfo.transientSeedSuffixStart);
    const validatorStake = await findStakeProgramAddress(STAKE_POOL_PROGRAM_ID, validatorInfo.voteAccountAddress, stakePoolAddress);
    const instructions = [];
    instructions.push(StakePoolInstruction.removeValidatorFromPool({
        stakePool: stakePoolAddress,
        staker: stakePool.account.data.staker,
        withdrawAuthority,
        validatorList: stakePool.account.data.validatorList,
        validatorStake,
        transientStake,
    }));
    return {
        instructions,
    };
}
