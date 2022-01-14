// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IUniRouter.sol";
import "./interface/IStaker.sol";
import "./interface/ERC20.sol";

import "@nomiclabs/buidler/console.sol";

contract AirDrop is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // deposit users
    EnumerableSet.AddressSet internal depositUsers;
    EnumerableSet.AddressSet internal depositTokens;

    mapping(address => mapping(address => uint256)) public userLendAmount;
    mapping(address => mapping(address => uint256)) public userBorrowAmount;
    mapping(address => mapping(address => uint256)) public userLpAmount;

    mapping(address => uint256) public lendAmount;
    mapping(address => uint256) public borrowAmount;
    mapping(address => uint256) public lpAmount;

    mapping(address => uint256) public tokenPrice;

    uint256 public lendRewardPer;
    uint256 public borrowRewardPer;
    uint256 public lpRewardPer;

    uint256 public lendTotalValue;
    uint256 public borrowTotalValue;
    uint256 public lpTotalValue;

    uint256 public lendRewardAmount;
    uint256 public borrowRewardAmount;
    uint256 public lpRewardAmount;

    uint256 public dayPer = 3000 ether;

    uint256 public lendRatio = 2500;
    uint256 public borrowRatio = 3000;
    uint256 public lpRatio = 4500;

    IERC20 public rewardToken;

    address public router;
    address public staker;
    mapping(address => bool) public pledge;

    mapping(address => address[]) tokenPaths;

    constructor(address _rewardToken, address _router) public {
        rewardToken = IERC20(_rewardToken);
        router = _router;
        lendRewardAmount = _caculateRewardAmount(lendRatio);
        console.log("lendRewardAmount: %s", lendRewardAmount);
        borrowRewardAmount = _caculateRewardAmount(borrowRatio);
        console.log("borrowRewarAmount: %s", borrowRewardAmount);
        lpRewardAmount = _caculateRewardAmount(lpRatio);
        console.log("lpRewardAmount: %s", lpRewardAmount);
    }

    function setRouter(address _router) external onlyOwner {
        router = _router;
    }

    function setStaker(address _staker) external onlyOwner {
        staker = _staker;
    }

    function setPledges(address[] calldata _pledgeAddress, bool[] calldata _enable) external onlyOwner {
        for (uint256 index = 0; index < _pledgeAddress.length; index++) {
            pledge[_pledgeAddress[index]] = _enable[index];
        }
    }

    function setPaths(address _token, address[] calldata _paths) external onlyOwner {
        tokenPaths[_token] = _paths;
    }

    function setConfig(
        uint256 _dayPer,
        uint256 _lendRatio,
        uint256 _borrowRatio,
        uint256 _lpRatio
    ) external onlyOwner {
        dayPer = _dayPer;
        lpRatio = _lpRatio;
        lendRatio = _lendRatio;
        borrowRatio = _borrowRatio;
        lendRewardAmount = _caculateRewardAmount(_lendRatio);
        console.log("lendRewardAmount: %s", lendRewardAmount);
        borrowRewardAmount = _caculateRewardAmount(_borrowRatio);
        console.log("borrowRewarAmount: %s", borrowRewardAmount);
        lpRewardAmount = _caculateRewardAmount(_lpRatio);
        console.log("lpRewardAmount: %s", lpRewardAmount);
    }

    function _caculateRewardAmount(uint256 _ratio) internal view returns (uint256) {
        return dayPer.mul(_ratio).div(10000);
    }

    function updateFromLend(
        address _account,
        address _token,
        uint256 _amount
    ) external onlyPledge {
        _updateDepositInfo(_account, _token);
        userLendAmount[_account][_token] += userLendAmount[_account][_token].add(_amount);
        lendAmount[_token] = lendAmount[_token].add(_amount);
    }

    function updateFromBorrow(
        address _account,
        address _token,
        uint256 _amount
    ) external onlyPledge {
        _updateDepositInfo(_account, _token);
        userBorrowAmount[_account][_token] += userBorrowAmount[_account][_token].add(_amount);
        borrowAmount[_token] = borrowAmount[_token].add(_amount);
    }

    function updateFromLiquidity(
        address _account,
        address _token,
        uint256 _amount
    ) external onlyPledge {
        _updateDepositInfo(_account, _token);
        userLpAmount[_account][_token] = userLpAmount[_account][_token].add(_amount);
        lpAmount[_token] = lpAmount[_token].add(_amount);
    }

    function _updateDepositInfo(address _account, address _token) internal {
        depositUsers.add(_account);
        depositTokens.add(_token);
    }

    function calculateEarn() external onlyOwner {
        for (uint256 index = 0; index < depositTokens.length(); index++) {
            address token = depositTokens.at(index);
            uint256 price = _tokenPrice(token);
            tokenPrice[token] = price;
            lendTotalValue += lendAmount[token].mul(price);
            borrowTotalValue += borrowAmount[token].mul(price);
            lpTotalValue += lpAmount[token].mul(price);
            console.log("token Price: %s", price);
        }

        if (lendTotalValue > 0) {
            if (lendTotalValue >= 1e18) {
                lendTotalValue = lendTotalValue.div(1e18);
            }
            lendRewardPer = lendRewardAmount.div(lendTotalValue);
            console.log("lendTotalValue: %s", lendTotalValue);
            console.log("lendRewardAmount: %s", lendRewardAmount);
            console.log("lendRewardPer: %s", lendRewardPer);
        }

        if (borrowTotalValue > 0) {
            if (borrowTotalValue >= 1e18) {
                borrowTotalValue = borrowTotalValue.div(1e18);
            }
            borrowRewardPer = borrowRewardAmount.div(borrowTotalValue);
            console.log("borrwoTotalValue: %s", borrowTotalValue);
            console.log("borrowRewardAmount: %s", borrowRewardAmount);
            console.log("borrowRewardPer: %s", borrowRewardPer);
        }

        if (lpTotalValue > 0) {
            if (lpTotalValue >= 1e18) {
                lpTotalValue = lpTotalValue.div(1e18);
            }
            lpRewardPer = lpRewardAmount.div(lpTotalValue);
            console.log("lpTotalValue: %s", lpTotalValue);
            console.log("lpRewardAmount: %s", lpRewardAmount);
            console.log("lpRewardPer: %s", lpRewardPer);
        }
    }

    function doAirdrop(uint256 _count) external onlyOwner {
        if (_count == 0) {
            _count = depositUsers.length();
        }
        for (uint256 index = 0; index < _count; index++) {
            address user = depositUsers.at(index);
            uint256 plgrAmount;
            for (uint256 j = 0; j < depositTokens.length(); j++) {
                address token = depositTokens.at(j);
                if (userLendAmount[user][token] > 0) {
                    if (userLendAmount[user][token].mul(tokenPrice[token]) >= 1e18) {
                        plgrAmount += userLendAmount[user][token].mul(tokenPrice[token]).div(1e18).mul(lendRewardPer);
                    } else {
                        plgrAmount += userLendAmount[user][token].mul(tokenPrice[token]).mul(lendRewardPer);
                    }
                }
                if (userBorrowAmount[user][token] > 0) {
                    if (userBorrowAmount[user][token].mul(tokenPrice[token]) >= 1e18) {
                        plgrAmount += userBorrowAmount[user][token].mul(tokenPrice[token]).div(1e18).mul(
                            borrowRewardPer
                        );
                    } else {
                        plgrAmount += userBorrowAmount[user][token].mul(tokenPrice[token]).mul(borrowRewardPer);
                    }
                }
                if (userLpAmount[user][token] > 0) {
                    if (userLpAmount[user][token].mul(tokenPrice[token]) >= 1e18) {
                        plgrAmount += userLpAmount[user][token].mul(tokenPrice[token]).div(1e18).mul(lpRewardPer);
                    } else {
                        plgrAmount += userLpAmount[user][token].mul(tokenPrice[token]).mul(lpRewardPer);
                    }
                }
            }
            console.log("plgr amount: ", plgrAmount);
            // IStaker(staker).mint(user, plgrAmount);
        }
        _reset(_count);
    }

    function depositUsersLen() external view returns (uint256) {
        return depositUsers.length();
    }

    function depositUser(uint256 _index) external view returns (address) {
        return depositUsers.at(_index);
    }

    function depositTokenLen() external view returns (uint256) {
        return depositTokens.length();
    }

    function depositToken(uint256 _index) external view returns (address) {
        return depositTokens.at(_index);
    }

    function _reset(uint256 _count) internal {
        if (_count == 0) {
            _count = depositUsers.length();
        }
        for (uint256 i = 0; i < _count; i++) {
            address user = depositUsers.at(i);

            for (uint256 j = 0; j < depositTokens.length(); j++) {
                address token = depositTokens.at(j);
                if (userLendAmount[user][token] > 0) {
                    delete userLendAmount[user][token];
                }
                if (userBorrowAmount[user][token] > 0) {
                    delete userBorrowAmount[user][token];
                }
                if (userLpAmount[user][token] > 0) {
                    delete userLpAmount[user][token];
                }
            }
        }

        for (uint256 i = 0; i < _count; i++) {
            address user = depositUsers.at(0);
            console.log("user: %s", user);
            depositUsers.remove(user);
        }

        if (depositUsers.length() == 0) {
            console.log("no users");
            lendTotalValue = 0;
            borrowTotalValue = 0;
            lpTotalValue = 0;

            for (uint256 j = 0; j < depositTokens.length(); j++) {
                address token = depositTokens.at(j);
                delete lendAmount[token];
                delete borrowAmount[token];
                delete lpAmount[token];
            }
        }
    }

    function _tokenPrice(address _token) internal view returns (uint256) {
        uint256 decimals = ERC20(_token).decimals();
        address[] memory path = tokenPaths[_token];

        if (path.length == 0) {
            return 1;
        }

        address counterAddress = path[path.length - 1];
        uint256 counterDecimals = ERC20(counterAddress).decimals();

        uint256[] memory _amounts = IUniRouter(router).getAmountsOut(10**decimals, path);
        uint256 price = _amounts[path.length - 1].div(10**counterDecimals);
        if (price == 0) {
            price = 1;
        }
        return price;
    }

    modifier onlyPledge() {
        require(pledge[msg.sender], "not Pledge");
        _;
    }
}
