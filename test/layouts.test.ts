import { StakePoolLayout, ValidatorListLayout, ValidatorList } from '../src/layouts';
import { divideBnToNumber } from '../src/utils';
import { deepStrictEqualBN } from './equal';
import { stakePoolMock, validatorListMock } from './mocks';

describe('layouts', () => {
  describe('StakePoolAccount', () => {
    it('should successfully decode StakePoolAccount data', () => {
      const encodedData = Buffer.alloc(1024);
      StakePoolLayout.encode(stakePoolMock, encodedData);
      const decodedData = StakePoolLayout.decode(encodedData);
      deepStrictEqualBN(decodedData, stakePoolMock);
    });
  });

  describe('ValidatorListAccount', () => {
    it('should successfully decode ValidatorListAccount account data', () => {
      const expectedData: ValidatorList = {
        accountType: 0,
        maxValidators: 10,
        validators: [],
      };
      const encodedData = Buffer.alloc(64);
      ValidatorListLayout.encode(expectedData, encodedData);
      const decodedData = ValidatorListLayout.decode(encodedData);
      expect(decodedData).toEqual(expectedData);
    });

    it('should successfully decode ValidatorListAccount with nonempty ValidatorInfo', () => {
      const encodedData = Buffer.alloc(1024);
      ValidatorListLayout.encode(validatorListMock, encodedData);
      const decodedData = ValidatorListLayout.decode(encodedData);
      deepStrictEqualBN(decodedData, validatorListMock);
    });
  });

  describe('StakePoolLayout', () => {
    it('should successfully decode', async () => {
      const data =
        'AWq1iyr99ATwNekhxZcljopQjeBixmWt+p/5CTXBmRbd3Noj1MlCDU6CVh08awajdvCUB/G3tPyo/emrHFdD8Wfh4Pippvxf8kLk81F78B7Wst0ZUaC6ttlDVyWShgT3cP/LqkIDCUdVLBkThURwDuYX1RR+JyWBHNvgnIkDCm914o2jckW1NrCzDbv9Jn/RWcT0cAMYKm8U4SfG/F878wV0XwxEYxirEMlfQJSVhXDNBXRlpU2rFNnd40gahv7V/Mvj/aPav/vdTOwRdFALTRZQlijB9G5myz+0QWe7U7EGIQbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpvg5b6DCoAQANR0RDLW0BAEECAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAnAAAAAAAAC0AAAAAAAAAAoA4AQAAAAAAhwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANAHAAAAAAAAAwAAAAAAAAACoA8AAAAAAAAJAAAAAAAAAKryysAqbQEA9duCPAOoAQAAicd7jscBANVMdCNW7gEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
      const buffer = Buffer.alloc(StakePoolLayout.span, data, 'base64');

      const stakePool = StakePoolLayout.decode(buffer);

      expect(
        divideBnToNumber(
          stakePool.nextSolWithdrawalFee!.numerator,
          stakePool.nextSolWithdrawalFee!.denominator,
        ),
      ).toEqual(0.00225);

      expect(
        divideBnToNumber(
          stakePool.nextStakeWithdrawalFee!.numerator,
          stakePool.nextStakeWithdrawalFee!.denominator,
        ),
      ).toEqual(0.0016875);

      expect(
        divideBnToNumber(
          stakePool.stakeWithdrawalFee.numerator,
          stakePool.stakeWithdrawalFee.denominator,
        ),
      ).toEqual(0.001125);

      expect(
        divideBnToNumber(
          stakePool.solWithdrawalFee.numerator,
          stakePool.solWithdrawalFee.denominator,
        ),
      ).toEqual(0.0015);
    });
  });
});
