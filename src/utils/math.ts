import BN from 'bn.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const SOL_DECIMALS = Math.log10(LAMPORTS_PER_SOL);

export function solToLamports(amount: number): number {
  if (Number.isNaN(amount)) {
    return Number(0);
  }
  return new BN(Number(amount).toFixed(SOL_DECIMALS).replace('.', '')).toNumber();
}

export function lamportsToSol(lamports: number | BN | bigint): number {
  if (typeof lamports === 'number') {
    return Math.abs(lamports) / LAMPORTS_PER_SOL;
  }
  if (typeof lamports === 'bigint') {
    return Math.abs(Number(lamports)) / LAMPORTS_PER_SOL;
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

export function divideBnToNumber(numerator: BN, denominator: BN): number {
  if (denominator.isZero()) {
    return 0;
  }
  const quotient = numerator.div(denominator).toNumber();
  const rem = numerator.umod(denominator);
  const gcd = rem.gcd(denominator);
  return quotient + rem.div(gcd).toNumber() / denominator.div(gcd).toNumber();
}
