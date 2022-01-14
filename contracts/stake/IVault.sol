// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVault {
    function approveToStaker(uint256 _amount) external;

    function withdraw(uint256 _amount) external;
}
