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

import {
  StakePoolLayout,
  ValidatorListLayout,
  ValidatorList,
} from '../src/layouts';
import { deepStrictEqualBN } from "./equal";
import { stakePoolMock, validatorListMock } from "./mocks";

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
});
