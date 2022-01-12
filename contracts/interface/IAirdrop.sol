// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IAirdrop {
    function updateFromLend(
        address _account,
        address _token,
        uint256 _amount
    ) external;

    function updateFromBorrow(
        address _account,
        address _token,
        uint256 _amount
    ) external;

    function updateFromLiquidity(
        address _account,
        address _token,
        uint256 _amount
    ) external;
}
