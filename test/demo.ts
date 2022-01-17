import chai from "chai";
import { solidity, deployContract } from "ethereum-waffle";
import { fixture, wallets, fixtureLoader, provider, fastForwardToMaturity, CURRENCY } from "./fixtures";
import { Wallet } from "ethers";
import { WeiPerEther } from "ethers/constants";

import { Ierc20 as ERC20 } from "../typechain/Ierc20";
import { CashMarket } from "../typechain/CashMarket";
import { IAirdrop } from "../typechain/IAirdrop";
import { IStaker } from "../typechain/IStaker";
// import { IVault } from "../typechain/IVault";
// import {ErrorDecoder, ErrorCodes} from "../scripts/errorCodes";
import { Escrow } from "../typechain/Escrow";
import { Portfolios } from "../typechain/Portfolios";
// import { Erc1155Token as ERC1155Token } from "../typechain/Erc1155Token";
import { TestUtils, BLOCK_TIME_LIMIT } from "./testUtils";
import {  BigNumberish, formatUnits, parseEther } from "ethers/utils";

import ERC1155MockReceiverArtifact from "../mocks/ERC1155MockReceiver.json";
import { Iweth } from "../typechain/Iweth";
// import { MockAggregator } from "../mocks/MockAggregator";
import { Erc1155Trade } from "../typechain/Erc1155Trade";

chai.use(solidity);
const { expect } = chai;

enum TradeType {
    TakeCollateral = 0,
    TakeFutureCash = 1,
    AddLiquidity = 2,
    RemoveLiquidity = 3,
}

// const REWARD_PER_DAY = WeiPerEther.mul(3000);
// const LEND_RATIO = new BigNumber(2500);
// const BORROW_RATIO = new BigNumber(3000);
// // const LP_RATIO = new BigNumber(4500);

describe("AirDrop", () => {
    let dai: ERC20;
    // let plgr: ERC20;
    let weth: Iweth;
    let wbnb: ERC20;
    let busd: ERC20;
    let owner: Wallet;
    let alice: Wallet;
    let bob: Wallet;
    let anna: Wallet;
    let rateAnchor: number;
    let futureCash: CashMarket;
    let escrow: Escrow;
    let portfolios: Portfolios;
    // eslint-disable-line no-unused-vars
    // let erc1155: ERC1155Token;
    let erc1155trade: Erc1155Trade;
    let t: TestUtils;
    let maturities: number[];
    let erc1155Receiver: any;
    // eslint-disable-line no-unused-vars
    // let chainlink: MockAggregator;
    let airdrop: IAirdrop;
    let staker: IStaker;
    // let vault: IVault;

    beforeEach(async () => {
        owner = wallets[0];
        alice = wallets[1];
        bob = wallets[2];
        anna = wallets[3];
        let objs = await fixtureLoader(fixture);

        dai = objs.erc20;
        // plgr = objs.plgr;
        busd = objs.busd;

        futureCash = objs.cashMarket;
        escrow = objs.escrow;
        portfolios = objs.portfolios;
        // erc1155 = objs.erc1155;
        weth = objs.weth;
        wbnb = objs.erc20;
        // chainlink = objs.chainlink;
        erc1155trade = objs.notional.erc1155trade;

        airdrop = objs.notional.airdrop;
        staker = objs.notional.staker;
        // vault = objs.notional.vault;

        await dai.transfer(alice.address, WeiPerEther.mul(200_000_000));
        await dai.transfer(bob.address, WeiPerEther.mul(200_000_000));
        await dai.transfer(anna.address, WeiPerEther.mul(200_000_000));

        await dai.connect(owner).approve(escrow.address, WeiPerEther.mul(200_000_000));
        await dai.connect(alice).approve(escrow.address, WeiPerEther.mul(200_000_000));
        await dai.connect(bob).approve(escrow.address, WeiPerEther.mul(200_000_000));
        await dai.connect(anna).approve(escrow.address, WeiPerEther.mul(200_000_000));

        await weth.connect(alice).deposit({ value: parseEther("1000") });
        await weth.connect(alice).approve(escrow.address, parseEther("100000000"));
        await weth.connect(bob).deposit({ value: parseEther("1000") });
        await weth.connect(bob).approve(escrow.address, parseEther("100000000"));
        await weth.connect(anna).deposit({ value: parseEther("1000") });
        await weth.connect(anna).approve(escrow.address, parseEther("100000000"));

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
        await escrow.connect(alice).deposit(dai.address, WeiPerEther.mul(1000));

        console.log("-----------------------------------");
        console.log("Init Config:");
        console.log(`Reward per day: 3000 PLGR`);
        console.log(`Lend reward ratio: 25%, 750PLGR`);
        console.log(`Borrow reward ratio: 30%, 900 PLGR`);
        console.log(`Add Liquidity reward ratio: 45%, 1350 PLGR`);

        console.log("on Pancke, current reserve for BNB-BUSD is 100:10000");
        console.log("on Pancke, 1 BNB can swap for 99 BUSD ");
    });

    afterEach(async () => {
        expect(await t.checkEthBalanceIntegrity([owner, alice, bob, anna, erc1155Receiver])).to.be.true;
        expect(await t.checkBalanceIntegrity([owner, alice, bob, anna, erc1155Receiver])).to.be.true;
        expect(await t.checkMarketIntegrity([owner, alice, bob, anna, erc1155Receiver], maturities)).to.be.true;
        // console.log(chainlink.address);
        // console.log(erc1155.address);
        // console.log(airdrop.address);
        // console.log(staker.address);
        // console.log(vault.address);
        // console.log(anna.address);
        // console.log(plgr.address);
        // console.log(BORROW_RATIO);
        // console.log(LP_RATIO);
    });

    async function earnedBalances(user: Wallet, toString = true) {
        const balances = await staker.earnedBalances(user.address);
        return toString ? balances.toString() : balances;
    }

    async function checkEarnBalance(user: Wallet) {
        const balances = await earnedBalances(user, false);
        const total = balances[0];
        // expect(total).to.gt(balance);
        return total;
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

        // check && expect(await t.hasCashReceiver(user, maturities[maturitiesIndex], new BigNumber(amount))).to.be.true;
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
        // check &&
        // expect(await t.hasCashPayer(user, maturities[maturitiesIndex], new BigNumber(borrowAmount))).to.be.true;
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
        // check && expect(await t.hasLiquidityToken(user, maturities[maturitiesIndex], new BigNumber(amount))).to.be.true;
    }

    

    it("First Day", async () => {
        console.log("-------------First Day------------------");
        await lend(0, CURRENCY.DAI, alice, WeiPerEther.mul(100));
        console.log("Alice lend 100 DAI");
        await lend(0, CURRENCY.DAI, bob, WeiPerEther.mul(100));
        console.log("Bob lend 100 DAI");
        await lend(0, CURRENCY.DAI, anna, WeiPerEther.mul(100));
        console.log("Anna lend 100 DAI");
        console.log("-----------------------------------");
      
        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);
        console.log("Distributed finished");
        console.log("-----------------------------------");
        let b = await checkEarnBalance(alice);
        console.log(
            `Alice earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(bob);
        console.log(
            `Bob earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(anna);
        console.log(
            `Anna earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        console.log("---------------END-----------------");
    });

    it("Secend Day", async () => {
        console.log("-------------SecondDay------------------");
        await lend(0, CURRENCY.DAI, alice, WeiPerEther.mul(100));
        console.log("Alice lend 100 DAI");
        await lend(0, CURRENCY.DAI, bob, WeiPerEther.mul(100));
        console.log("Bob lend 100 DAI");
        await lend(0, CURRENCY.DAI, anna, WeiPerEther.mul(100));
        console.log("Anna lend 100 DAI");
        console.log("-----------------------------------");
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), alice, parseEther("100"));
        console.log("Alice borrow 100 DAI and uses 1.5 ETH as collateral ");
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), bob, parseEther("100"));
        console.log("Bob borrow 100 DAI and uses 1.5 ETH as collateral ");
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), anna, parseEther("100"));
        console.log("Anna borrow 100 DAI and uses 1.5 ETH as collateral ");
        console.log("-----------------------------------");
      
        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);
        console.log("Distributed finished");
        console.log("-----------------------------------");
        let b = await checkEarnBalance(alice);
        console.log(
            `Alice earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(bob);
        console.log(
            `Bob earns ${b}, ${formatUnits(b, 18)}  PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(anna);
        console.log(
            `Anna earns ${b}, ${formatUnits(b, 18)}  PLGR, which automatically locks in the Stake contract for 90 days`
        );
        console.log("--------------END------------------");
    });

    it("Third day ", async () => {
        console.log("-------------ThirdDay----------------");
        await lend(0, CURRENCY.DAI, alice, WeiPerEther.mul(100));
        console.log("Alice lend 100 DAI");
        await lend(0, CURRENCY.DAI, bob, WeiPerEther.mul(100));
        console.log("Bob lend 100 DAI");
        await lend(0, CURRENCY.DAI, anna, WeiPerEther.mul(100));
        console.log("Anna lend 100 DAI");
        console.log("-----------------------------------");
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), alice, parseEther("100"));
        console.log("Alice borrow 100 DAI and uses 1.5 ETH as collateral ");
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), bob, parseEther("100"));
        console.log("Bob borrow 100 DAI and uses 1.5 ETH as collateral ");
        await borrow(0, CURRENCY.ETH, parseEther("1.5"), anna, parseEther("100"));
        console.log("Anna borrow 100 DAI and uses 1.5 ETH as collateral ");
        console.log("-----------------------------------");

        console.log("PLGR Manager add liquidity with 10000 DAI");
        console.log("Alice add liquidity with 10000 DAI");
        await addLiquidity(0, CURRENCY.DAI, alice, WeiPerEther.mul(10_000));
        console.log("Bob add liquidity with 10000 DAI");
        await addLiquidity(0, CURRENCY.DAI, bob, WeiPerEther.mul(10_000));
        console.log("Anna add liquidity with 10000 DAI");
        await addLiquidity(0, CURRENCY.DAI, anna, WeiPerEther.mul(10_000));
        console.log("-----------------------------------");

        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);
        console.log("Distributed finished");
        console.log("-----------------------------------");

        let b = await checkEarnBalance(owner);
        console.log(
            `PLGR Manager earns ${b}, ${formatUnits(
                b,
                18
            )} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(alice);
        console.log(
            `Alice earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(bob);
        console.log(
            `Bob earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(anna);
        console.log(
            `Anna earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );

        console.log("---------------END-----------------");
    });
    it("Fourth day ", async () => {
        console.log("-------------FourthDay-----------------");
        await lend(0, CURRENCY.DAI, alice, WeiPerEther.mul(200));
        console.log("Alice lend 200 DAI");
        await lend(0, CURRENCY.DAI, bob, WeiPerEther.mul(300));
        console.log("Bob lend 300 DAI");
        await lend(0, CURRENCY.DAI, anna, WeiPerEther.mul(500));
        console.log("Anna lend 500 DAI");
        console.log("-----------------------------------");
        await borrow(0, CURRENCY.ETH, parseEther("3"), alice, parseEther("200"));
        console.log("Alice borrow 200 DAI and uses 3.0 ETH as collateral ");
        await borrow(0, CURRENCY.ETH, parseEther("4"), bob, parseEther("300"));
        console.log("Bob borrow 300 DAI and uses 4.0 ETH as collateral ");
        await borrow(0, CURRENCY.ETH, parseEther("7"), anna, parseEther("500"));
        console.log("Anna borrow 500 DAI and uses 7.0 ETH as collateral ");
        console.log("-----------------------------------");

        console.log("PLGR Manager add liquidity with 10000 DAI");
        console.log("Alice add liquidity with 20000 DAI");
        await addLiquidity(0, CURRENCY.DAI, alice, WeiPerEther.mul(20_000));
        console.log("Bob add liquidity with 30000 DAI");
        await addLiquidity(0, CURRENCY.DAI, bob, WeiPerEther.mul(30_000));
        console.log("Anna add liquidity with 40000 DAI");
        await addLiquidity(0, CURRENCY.DAI, anna, WeiPerEther.mul(40_000));
        console.log("-----------------------------------");

        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);
        console.log("Distributed finished");
        console.log("-----------------------------------");

        let b = await checkEarnBalance(owner);
        console.log(
            `PLGR Manager earns ${b}, ${formatUnits(
                b,
                18
            )} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(alice);
        console.log(
            `Alice earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(bob);
        console.log(
            `Bob earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(anna);
        console.log(
            `Anna earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );

        console.log("---------------END-----------------");
    });

    it("Fifth Day", async () => {
        console.log("-------------Day------------------");
        await airdrop.setPaths(wbnb.address, [wbnb.address, busd.address]);
        await lend(0, CURRENCY.WBNB, alice, parseEther("1.2"));
        console.log("Alice lend 1.2 WBNB");
        await lend(0, CURRENCY.WBNB, bob, parseEther("1.25"));
        console.log("Bob lend 1.25 WBNB");
        await lend(0, CURRENCY.WBNB, anna, parseEther("7.65"));
        console.log("Anna lend 7.65 WBNB");
        console.log("-----------------------------------");
        await airdrop.connect(owner).calculateEarn();
        await airdrop.doAirdrop(0);
        console.log("Distributed finished");
        console.log("-----------------------------------");
        let b = await checkEarnBalance(alice);
        console.log(
            `Alice earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(bob);
        console.log(
            `Bob earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        b = await checkEarnBalance(anna);
        console.log(
            `Anna earns ${b}, ${formatUnits(b, 18)} PLGR, which automatically locks in the Stake contract for 90 days`
        );
        console.log("---------------END-----------------");
    });
});
