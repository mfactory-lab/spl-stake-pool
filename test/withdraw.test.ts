// Polyfill crypto before web3.js imports (see instructions.test.ts).
import { randomBytes } from 'crypto';

Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: (arr: any) => randomBytes(arr.length),
  },
});

import {
  AccountInfo,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  StakeProgram,
} from '@solana/web3.js';
import BN from 'bn.js';
import { prepareWithdrawAccounts } from '../src/utils/stake';
import { ValidatorListLayout, ValidatorStakeInfo, ValidatorStakeInfoStatus } from '../src/layouts';
import { stakePoolMock } from './mocks';

const STAKE_ACCOUNT_RENT_EXEMPTION = 2_282_880; // rent-exempt reserve for a 200-byte stake account
const stakePoolAddress = new PublicKey('SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy');

function encodeValidatorList(validators: ValidatorStakeInfo[]): Buffer {
  const data = Buffer.alloc(1024);
  ValidatorListLayout.encode({ accountType: 0, maxValidators: 100, validators }, data);
  return data;
}

function activeValidator(voteHex: string, activeStakeLamports: number): ValidatorStakeInfo {
  return {
    status: ValidatorStakeInfoStatus.Active,
    voteAccountAddress: new PublicKey(new BN(voteHex, 'hex')),
    lastUpdateEpoch: new BN(0),
    activeStakeLamports: new BN(activeStakeLamports),
    transientStakeLamports: new BN(0),
    transientSeedSuffixStart: new BN(0),
    transientSeedSuffixEnd: new BN(0),
  } as ValidatorStakeInfo;
}

// vote account of the drained validator that reproduced the on-chain 0x17 failure
const DRAINED_VOTE = '3796d40645ee07e3c64117e3f73430471d4c40465f696ebc9b034c1fc06a9f7d';
const HEALTHY_VOTE = 'e4e37d6f2e80c0bb0f3da8a06304e57be5cda6efa2825b86780aa320d9784cf8';

function mockConnection(validators: ValidatorStakeInfo[], minimumDelegation: number): Connection {
  const connection = new Connection('http://127.0.0.1:8899');
  connection.getMinimumBalanceForRentExemption = jest.fn(async () => STAKE_ACCOUNT_RENT_EXEMPTION);
  connection.getStakeMinimumDelegation = jest.fn(async () => ({
    context: { slot: 0 },
    value: minimumDelegation,
  })) as any;
  connection.getAccountInfo = jest.fn(async (pubKey: PublicKey) => {
    if (pubKey.equals(stakePoolMock.validatorList)) {
      return <AccountInfo<any>>{
        executable: true,
        owner: StakeProgram.programId,
        lamports: 0,
        data: encodeValidatorList(validators),
      };
    }
    if (pubKey.equals(stakePoolMock.reserveStake)) {
      // reserve holds only its rent-exempt reserve -> nothing withdrawable
      return <AccountInfo<any>>{
        executable: false,
        owner: StakeProgram.programId,
        lamports: STAKE_ACCOUNT_RENT_EXEMPTION,
        data: Buffer.alloc(200),
      };
    }
    return null;
  });
  return connection;
}

describe('prepareWithdrawAccounts minimum-delegation handling', () => {
  it('skips a validator drained below the on-chain minimum delegation (1 SOL)', async () => {
    // Validator holds 3_288_228 lamports: above the stale 0.001-SOL floor but far
    // below the real 1-SOL minimum delegation. Selecting it produces the on-chain
    // StakeLamportsNotEqualToMinimum (0x17) failure, so it MUST be skipped.
    const connection = mockConnection([activeValidator(DRAINED_VOTE, 3_288_228)], LAMPORTS_PER_SOL);

    await expect(
      prepareWithdrawAccounts(connection, stakePoolMock, stakePoolAddress, new BN(100)),
    ).rejects.toThrow(/No stake accounts found/);
  });

  it('still selects a validator that holds well above the minimum delegation', async () => {
    const connection = mockConnection(
      [activeValidator(HEALTHY_VOTE, LAMPORTS_PER_SOL * 100)],
      LAMPORTS_PER_SOL,
    );

    const accounts = await prepareWithdrawAccounts(
      connection,
      stakePoolMock,
      stakePoolAddress,
      new BN(100),
    );

    expect(accounts).toHaveLength(1);
    expect(accounts[0].voteAddress?.toBase58()).toEqual(
      new PublicKey(new BN(HEALTHY_VOTE, 'hex')).toBase58(),
    );
  });
});
