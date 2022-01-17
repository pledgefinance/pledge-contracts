import chai from "chai";
import { solidity, deployContract } from "ethereum-waffle";
import { fixture, wallets, fixtureLoader, provider, fastForwardToMaturity, CURRENCY } from "./fixtures";
import { Wallet } from "ethers";
import { WeiPerEther } from "ethers/constants";

import { Ierc20 as ERC20 } from "../typechain/Ierc20";
import { CashMarket } from "../typechain/CashMarket";
import { IAirdrop } from "../typechain/IAirdrop";
import { IStaker } from "../typechain/IStaker";
import { IVault } from "../typechain/IVault";
// import {ErrorDecoder, ErrorCodes} from "../scripts/errorCodes";
import { Escrow } from "../typechain/Escrow";
import { Portfolios } from "../typechain/Portfolios";
import { Erc1155Token as ERC1155Token } from "../typechain/Erc1155Token";
import { TestUtils, BLOCK_TIME_LIMIT } from "./testUtils";
import { BigNumber, BigNumberish, parseEther } from "ethers/utils";

import ERC1155MockReceiverArtifact from "../mocks/ERC1155MockReceiver.json";
import { Iweth } from "../typechain/Iweth";
import { MockAggregator } from "../mocks/MockAggregator";
import { Erc1155Trade } from "../typechain/Erc1155Trade";

chai.use(solidity);
const { expect } = chai;

enum TradeType {
    TakeCollateral = 0,
    TakeFutureCash = 1,
    AddLiquidity = 2,
    RemoveLiquidity = 3,
}

// const getBlockTime = async (tx: any) => {
//     const blockInfo = await provider.getBlock(tx.blockNumber);
//     const time = blockInfo.timestamp;
//     return time;
// };

// const getLockedUntil = (time: any) => {
//     return new BigNumber(time).div(604800).add(13).mul(604800).toNumber();
// };
// const MAX_IMPLIED_RATE = 10_000_000;
// const MIN_IMPLIED_RATE = 0;

const REWARD_PER_DAY = WeiPerEther.mul(3000);
const LEND_RATIO = new BigNumber(2500);
const BORROW_RATIO = new BigNumber(3000);
const LP_RATIO = new BigNumber(4500);

describe("AirDrop", () => {
    let dai: ERC20;
    let plgr: ERC20;
    let weth: Iweth;
    let owner: Wallet;
    let wallet: Wallet;
    let wallet2: Wallet;
    let wallet3: Wallet;
    let rateAnchor: number;
    let futureCash: CashMarket;
    let escrow: Escrow;
    let portfolios: Portfolios;
    // eslint-disable-line no-unused-vars
    let erc1155: ERC1155Token;
    let erc1155trade: Erc1155Trade;
    let t: TestUtils;
    let maturities: number[];
    let erc1155Receiver: any;
    // eslint-disable-line no-unused-vars
    let chainlink: MockAggregator;
    let airdrop: IAirdrop;
    let staker: IStaker;
    let vault: IVault;

    beforeEach(async () => {
        owner = wallets[0];
        wallet = wallets[1];
        wallet2 = wallets[2];
        wallet3 = wallets[3];
        let objs = await fixtureLoader(fixture);

        dai = objs.erc20;
        plgr = objs.plgr;
        futureCash = objs.cashMarket;
        escrow = objs.escrow;
        portfolios = objs.portfolios;
        erc1155 = objs.erc1155;
        weth = objs.weth;
        chainlink = objs.chainlink;
        erc1155trade = objs.notional.erc1155trade;

        airdrop = objs.notional.airdrop;
        staker = objs.notional.staker;
        vault = objs.notional.vault;

        await dai.transfer(wallet.address, WeiPerEther.mul(200_000_000));
        await dai.transfer(wallet2.address, WeiPerEther.mul(200_000_000));
        await dai.transfer(wallet3.address, WeiPerEther.mul(200_000_000));

        await dai.connect(owner).approve(escrow.address, WeiPerEther.mul(200_000_000));
        await dai.connect(wallet).approve(escrow.address, WeiPerEther.mul(200_000_000));
        await dai.connect(wallet2).approve(escrow.address, WeiPerEther.mul(200_000_000));
        await dai.connect(wallet3).approve(escrow.address, WeiPerEther.mul(200_000_000));

        await weth.connect(wallet).deposit({ value: parseEther("1000") });
        await weth.connect(wallet).approve(escrow.address, parseEther("100000000"));
        await weth.connect(wallet2).deposit({ value: parseEther("1000") });
        await weth.connect(wallet2).approve(escrow.address, parseEther("100000000"));
        await weth.connect(wallet3).deposit({ value: parseEther("1000") });
        await weth.connect(wallet3).approve(escrow.address, parseEther("100000000"));

        rateAnchor = 1_050_000_000;
        await futureCash.setRateFactors(rateAnchor, 100);
        erc1155Receiver = await deployContract(owner, ERC1155MockReceiverArtifact);
        await escrow.connect(owner).deposit(dai.address, parseEther("50000"));

        // Set the blockheight to the beginning of the next period
        maturities = await futureCash.getActiveMaturities();
        await fastForwardToMaturity(provider, maturities[1]);

        t = new TestUtils(escrow, futureCash, portfolios, dai, owner, objs.chainlink, objs.weth, CURRENCY.DAI);
        maturities = await futureCash.getActiveMaturities();
        await t.setupLiquidity();
        await escrow.connect(wallet).deposit(dai.address, WeiPerEther.mul(1000));
    });

    afterEach(async () => {
        expect(await t.checkEthBalanceIntegrity([owner, wallet, wallet2, wallet3, erc1155Receiver])).to.be.true;
        expect(await t.checkBalanceIntegrity([owner, wallet, wallet2, wallet3, erc1155Receiver])).to.be.true;
        expect(await t.checkMarketIntegrity([owner, wallet, wallet2, wallet3, erc1155Receiver], maturities)).to.be.true;
        console.log(chainlink.address);
        console.log(erc1155.address);
        console.log(airdrop.address);
        console.log(staker.address);
        console.log(vault.address);
        console.log(wallet3.address);
        console.log(plgr.address);
        console.log(BORROW_RATIO);
        console.log(LP_RATIO);
    });

    async function earnedBalances(user: Wallet, toString = true) {
        const balances = await staker.earnedBalances(user.address);
        return toString ? balances.toString() : balances;
    }

    async function checkEarnBalance(user: Wallet, balance: BigNumber) {
        const balances = await earnedBalances(user, false);
        const total = balances[0];
        expect(total).to.gt(balance);
    }

    async function lend(
        maturitiesIndex: number,
        currencyId: BigNumberish,
        user: Wallet,
        amount: BigNumberish,
        check = true
    ) {
        await erc1155trade.connect(user).batchOperation(
            user.address,
            BLOCK_TIME_LIMIT,
            [{ currencyId: currencyId, amount: amount }],
            [
                {
                    tradeType: TradeType.TakeFutureCash,
                    cashGroup: 1,
                    maturity: maturities[maturitiesIndex],
                    amount: amount,
                    slippageData: "0x",
                },
            ]
        );

        check && expect(await t.hasCashReceiver(user, maturities[maturitiesIndex], new BigNumber(amount))).to.be.true;
    }

    async function borrow(
        maturitiesIndex: number,
        currencyId: BigNumberish,
        amount: BigNumberish,
        user: Wallet,
        borrowAmount: BigNumberish,
        check = true
    ) {
        await erc1155trade.connect(user).batchOperation(
            user.address,
            BLOCK_TIME_LIMIT,
            [{ currencyId: currencyId, amount }],
            [
                {
                    tradeType: TradeType.TakeCollateral,
                    cashGroup: 1,
                    maturity: maturities[maturitiesIndex],
                    amount: borrowAmount,
                    slippageData: "0x",
                },
            ]
        );
        check &&
            expect(await t.hasCashPayer(user, maturities[maturitiesIndex], new BigNumber(borrowAmount))).to.be.true;
    }

    async function addLiquidity(
        maturitiesIndex: number,
        currencyId: BigNumberish,
        user: Wallet,
        amount: BigNumberish,
        check = true
    ) {
        await erc1155trade.connect(user).batchOperation(
            user.address,
            BLOCK_TIME_LIMIT,
            [{ currencyId: currencyId, amount: amount }],
            [
                {
                    tradeType: TradeType.AddLiquidity,
                    cashGroup: 1,
                    maturity: maturities[maturitiesIndex],
                    amount: amount,
                    slippageData: "0x",
                },
            ]
        );
        check && expect(await t.hasLiquidityToken(user, maturities[maturitiesIndex], new BigNumber(amount))).to.be.true;
    }



    it("allows trade [deposit, takefCash] wei", async () => {
        await lend(0, CURRENCY.DAI, wallet, 100);
        await lend(0, CURRENCY.DAI, wallet2, 100);
        await lend(0, CURRENCY.DAI, wallet3, 100);
        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);
        await checkEarnBalance(wallet, REWARD_PER_DAY.mul(LEND_RATIO).div(10000).div(3).sub(1e9));
        await checkEarnBalance(wallet2, REWARD_PER_DAY.mul(LEND_RATIO).div(10000).div(3).sub(1e9));
        await checkEarnBalance(wallet3, REWARD_PER_DAY.mul(LEND_RATIO).div(10000).div(3).sub(1e9));
    });

    it("allows trade [deposit, takefCash]", async () => {
        await lend(0, CURRENCY.DAI, wallet, WeiPerEther.mul(100));
        await lend(0, CURRENCY.DAI, wallet2, WeiPerEther.mul(100));
        await lend(0, CURRENCY.DAI, wallet3, WeiPerEther.mul(100));

        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);

        await checkEarnBalance(wallet, REWARD_PER_DAY.mul(LEND_RATIO).div(10000).div(3).sub(1e9));
        await checkEarnBalance(wallet2, REWARD_PER_DAY.mul(LEND_RATIO).div(10000).div(3).sub(1e9));
        await checkEarnBalance(wallet3, REWARD_PER_DAY.mul(LEND_RATIO).div(10000).div(3).sub(1e9));
    });

    it("allows trade [deposit, takeCurrentCash]", async () => {
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), wallet, parseEther("100"));
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), wallet2, parseEther("100"));
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), wallet3, parseEther("100"));

        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);

        await checkEarnBalance(wallet, REWARD_PER_DAY.mul(BORROW_RATIO).div(10000).div(3).sub(1e9));
        await checkEarnBalance(wallet2, REWARD_PER_DAY.mul(BORROW_RATIO).div(10000).div(3).sub(1e9));
        await checkEarnBalance(wallet3, REWARD_PER_DAY.mul(BORROW_RATIO).div(10000).div(3).sub(1e9));
    });

    it("allows trade [deposit, addLiquidity]", async () => {
        await addLiquidity(0, CURRENCY.DAI, wallet, WeiPerEther.mul(10_000));
        await addLiquidity(0, CURRENCY.DAI, wallet2, WeiPerEther.mul(10_000));
        await addLiquidity(0, CURRENCY.DAI, wallet3, WeiPerEther.mul(10_000));

        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);

        await checkEarnBalance(owner, REWARD_PER_DAY.mul(LP_RATIO).div(10000).div(4).sub(1e9));
        await checkEarnBalance(wallet, REWARD_PER_DAY.mul(LP_RATIO).div(10000).div(4).sub(1e9));
        await checkEarnBalance(wallet2, REWARD_PER_DAY.mul(LP_RATIO).div(10000).div(4).sub(1e9));
        await checkEarnBalance(wallet3, REWARD_PER_DAY.mul(LP_RATIO).div(10000).div(4).sub(1e9));
    });

    it("allows trade [deposit, takefCash, takeCurrentCash]", async () => {
        await lend(0, CURRENCY.DAI, wallet, WeiPerEther.mul(100));
        await lend(0, CURRENCY.DAI, wallet2, WeiPerEther.mul(100));
        await lend(0, CURRENCY.DAI, wallet3, WeiPerEther.mul(100));

        await borrow(0, CURRENCY.ETH, parseEther("1.5"), wallet, parseEther("100"), false);
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), wallet2, parseEther("100"), false);
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), wallet3, parseEther("100"), false);

        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);

        await checkEarnBalance(wallet, REWARD_PER_DAY.mul(LEND_RATIO.add(BORROW_RATIO)).div(10000).div(3).sub(1e9));
        await checkEarnBalance(wallet2, REWARD_PER_DAY.mul(LEND_RATIO.add(BORROW_RATIO)).div(10000).div(3).sub(1e9));
        await checkEarnBalance(wallet3, REWARD_PER_DAY.mul(LEND_RATIO.add(BORROW_RATIO)).div(10000).div(3).sub(1e9));
    });

    it("allows trade [deposit, takefCash, takeCurrentCash, addLiquidity]", async () => {
        await lend(0, CURRENCY.DAI, wallet, WeiPerEther.mul(100));
        await lend(0, CURRENCY.DAI, wallet2, WeiPerEther.mul(100));
        await lend(0, CURRENCY.DAI, wallet3, WeiPerEther.mul(100));

        await borrow(0, CURRENCY.ETH, parseEther("1.5"), wallet, parseEther("100"), false);
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), wallet2, parseEther("100"), false);
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), wallet3, parseEther("100"), false);

        await addLiquidity(0, CURRENCY.DAI, wallet, WeiPerEther.mul(10_000), false);
        await addLiquidity(0, CURRENCY.DAI, wallet2, WeiPerEther.mul(10_000), false);
        await addLiquidity(0, CURRENCY.DAI, wallet3, WeiPerEther.mul(10_000), false);

        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);

        let amount = REWARD_PER_DAY.mul(LEND_RATIO.add(BORROW_RATIO)).div(10000).div(3).sub(1e9);
        amount = amount.add(REWARD_PER_DAY.mul(LP_RATIO).div(10000).div(4).sub(1e9));

        await checkEarnBalance(owner, REWARD_PER_DAY.mul(LP_RATIO).div(10000).div(4).sub(1e9));
        await checkEarnBalance(wallet, amount);
        await checkEarnBalance(wallet2, amount);
        await checkEarnBalance(wallet3, amount);
    });
});
