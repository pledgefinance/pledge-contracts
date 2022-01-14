// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IEscrow {
   function currencyIdToAddress(uint16 i) view external returns(address);
}
