// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../utils/Governed.sol";

contract Vault is Governed {
    IERC20 public token;
    address public staker;

    mapping(address => bool) public governace;

    function initialize(
        address directory,
        address owner,
        address _rewardToken
    ) public initializer {
        Governed.initialize(directory, owner);
        token = IERC20(_rewardToken);
        governace[owner] = true;
    }

    function setStaker(address _staker) public onlyGovernace {
        staker = _staker;
    }

    function approveToStaker(uint256 _amount) public onlyStaker {
        token.approve(staker, _amount);
    }

    function withdraw(uint256 _amount) public onlyGovernace {
        uint256 balance = token.balanceOf(address(this));
        require(_amount <= balance);
        if (_amount == 0) {
            token.transfer(msg.sender, balance);
        } else {
            token.transfer(msg.sender, _amount);
        }
    }

    function setGovernace(address[] calldata _address, bool[] calldata _enable) external onlyOwner {
        for (uint256 index = 0; index < _address.length; index++) {
            governace[_address[index]] = _enable[index];
        }
    }

    modifier onlyStaker() {
        require(staker == msg.sender);
        _;
    }

    modifier onlyGovernace() {
        require(governace[msg.sender], "not Governace");
        _;
    }
}
