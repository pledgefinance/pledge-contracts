// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vault {
    IERC20 public token;
    address public staker;
    address private owner;

    constructor(address _token) public {
        token = IERC20(_token);
        owner = msg.sender;
    }

    function setStaker(address _staker) public onlyOwner {
        staker = _staker;
    }

    function approveToStaker(uint256 _amount) public onlyStaker {
        token.approve(staker, _amount);
    }

    function withdraw(uint256 _amount) public onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        require(_amount <= balance);
        if (_amount == 0) {
            token.transfer(msg.sender, balance);
        } else {
            token.transfer(msg.sender, _amount);
        }
    }

    modifier onlyStaker() {
        require(staker == msg.sender);
        _;
    }

    modifier onlyOwner() {
        require(owner == msg.sender);
        _;
    }
}
