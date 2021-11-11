import chai from "chai";
import {solidity} from "ethereum-waffle";
import {
    fixture,
    wallets,
    fixtureLoader,
    provider,
    CURRENCY,
    fastForwardToMaturity,
    fastForwardToTime,
} from "./fixtures";
import {Wallet, ethers} from "ethers";
import {WeiPerEther} from "ethers/constants";

import {Ierc20 as ERC20} from "../typechain/Ierc20";
import {CashMarket} from "../typechain/CashMarket";

import {Escrow} from "../typechain/Escrow";
import {Portfolios} from "../typechain/Portfolios";
import {TestUtils, BLOCK_TIME_LIMIT} from "./testUtils";

chai.use(solidity);
const {expect} = chai;
const MIN_IMPLIED_RATE = 0;

describe("Action Tests", () => {
    let dai: ERC20;
    let owner: Wallet;
    let wallet: Wallet;
    let wallet2: Wallet;
    let futureCash: CashMarket;
    let escrow: Escrow;
    let portfolios: Portfolios;
    let t: TestUtils;
    let maturities: number[];

    beforeEach(async () => {
        owner = wallets[0];
        wallet = wallets[1];
        wallet2 = wallets[2];
        let objs = await fixtureLoader(fixture);

        dai = objs.erc20;
        futureCash = objs.cashMarket;
        escrow = objs.escrow;
        portfolios = objs.portfolios;

        await dai.transfer(wallet.address, WeiPerEther.mul(10_000));
        await dai.transfer(wallet2.address, WeiPerEther.mul(10_000));

        await dai.connect(owner).approve(escrow.address, WeiPerEther.mul(100_000_000));
        await dai.connect(wallet).approve(escrow.address, WeiPerEther.mul(100_000_000));
        await dai.connect(wallet2).approve(escrow.address, WeiPerEther.mul(100_000_000));

        // Set the blockheight to the beginning of the next period
        maturities = await futureCash.getActiveMaturities();
        await fastForwardToMaturity(provider, maturities[1]);
        maturities = await futureCash.getActiveMaturities();

        t = new TestUtils(escrow, futureCash, portfolios, dai, owner, objs.chainlink, objs.weth, CURRENCY.DAI);
    });

    afterEach(async () => {
        expect(await t.checkEthBalanceIntegrity([owner, wallet, wallet2])).to.be.true;
        expect(await t.checkBalanceIntegrity([owner, wallet, wallet2])).to.be.true;
        expect(await t.checkMarketIntegrity([owner, wallet, wallet2], maturities)).to.be.true;
    });

    it.only("Lend Tests", async () => {
        //console.log(ethers.utils.formatEther(await dai.balanceOf(wallet.address)))

        await t.setupLiquidity();

        const daiBalance = await dai.balanceOf(wallet.address);
        const escrowBalance = await escrow.cashBalances(CURRENCY.DAI, wallet.address);

        await escrow.connect(wallet).deposit(dai.address, WeiPerEther.mul(100));

        const daiBalanceAfter = await dai.balanceOf(wallet.address);
        const expectedDaiBalance = daiBalance.sub(WeiPerEther.mul(100));
        const escrowBalanceAfter = await escrow.cashBalances(CURRENCY.DAI, wallet.address);
        const expectedEscrowBalance = escrowBalance.add(WeiPerEther.mul(100));

        expect(daiBalanceAfter, "user wallet balance decreases").to.equal(expectedDaiBalance);
        expect(escrowBalanceAfter, "escrow increased by lent amount").to.equal(expectedEscrowBalance);

        const fCash = (await futureCash.getMarket(maturities[0])).totalfCash;

        //console.log(ethers.utils.formatEther(fCashBeforeLend))
        await futureCash
            .connect(wallet)
            .takefCash(maturities[0], WeiPerEther.mul(100), BLOCK_TIME_LIMIT, MIN_IMPLIED_RATE);
        //console.log(ethers.utils.formatEther((await futureCash.getMarket(maturities[0])).totalfCash))
        const fCashAfter = (await futureCash.getMarket(maturities[0])).totalfCash;
        const expectedfCash = fCash.sub(WeiPerEther.mul(100));

        expect(fCashAfter, "Cash decreased by lent amount").to.equal(expectedfCash);
    });

    it.only("Borrow Tests", async () => {
        await t.setupLiquidity();

        // Deposit ETH as collateral for a loan.
        await escrow.connect(wallet).depositEth({value: WeiPerEther.mul(5)});

        const freeCollateral = (await portfolios.freeCollateralView(wallet.address))[0];

        console.log("Pre free collateral " + ethers.utils.formatEther(freeCollateral));

        const blockTime = await fastForwardToTime(provider);
        const daiBalance = await futureCash.getfCashToCurrentCashAtTime(maturities[0], WeiPerEther.mul(100), blockTime);

        console.log("Dai balance " + ethers.utils.formatEther(daiBalance));

        const fCash = (await futureCash.getMarket(maturities[0])).totalfCash;

        console.log(ethers.utils.formatEther(fCash));

        // Deposit 100 dai in fCash, collateralized by an ETH
        await futureCash
            .connect(wallet)
            .takeCurrentCash(maturities[0], WeiPerEther.mul(100), BLOCK_TIME_LIMIT, 60_000_000);

        expect(await t.hasCashPayer(wallet, maturities[0], WeiPerEther.mul(100)), "user owns borrowed amount").to.be
            .true;

        const fCashAfter = (await futureCash.getMarket(maturities[0])).totalfCash;

        expect(fCashAfter, "fCash increased by borrowed amount").to.equal(fCash.add(WeiPerEther.mul(100)));

        const freeCollateralAfter = (await portfolios.freeCollateralView(wallet.address))[0];
        console.log("Post free collateral " + ethers.utils.formatEther(freeCollateralAfter));

        const escrowBalance = await escrow.cashBalances(CURRENCY.DAI, wallet.address);
        const walletBalance = await dai.balanceOf(wallet.address);
        console.log("escrowBalance " + ethers.utils.formatEther(escrowBalance));
        console.log("walletBalance " + ethers.utils.formatEther(walletBalance));

        expect(escrowBalance, "borrowed amount in escrow before withdraw").to.equal(daiBalance);

        await escrow.connect(wallet).withdraw(dai.address, escrowBalance);

        const escrowBalanceAfter = await escrow.cashBalances(CURRENCY.DAI, wallet.address);
        const walletBalanceAfter = await dai.balanceOf(wallet.address);
        console.log("escrowBalanceAfter " + ethers.utils.formatEther(escrowBalanceAfter));
        console.log("walletBalanceAfter " + ethers.utils.formatEther(walletBalanceAfter));

        expect(escrowBalanceAfter, "escrow reduces by the withdrawn amount").to.equal(escrowBalance.sub(daiBalance));
        expect(walletBalanceAfter, "user gets borrowed amount inwallet balance").to.equal(
            walletBalance.add(daiBalance)
        );

        expect(freeCollateral.sub(freeCollateralAfter), "some eth was collateralized").to.be.above(0);
    });

    it.only("Add Liquidity Tests", async () => {
        const walletBalance = await dai.balanceOf(owner.address);
        const poolBalance = (await futureCash.getMarket(maturities[0])).totalLiquidity;

        await escrow.deposit(dai.address, WeiPerEther.mul(500));

        const escrowBalance = await escrow.cashBalances(CURRENCY.DAI, owner.address);

        await futureCash.addLiquidity(
            maturities[0],
            WeiPerEther.mul(100),
            WeiPerEther.mul(200),
            0,
            100_000_000,
            BLOCK_TIME_LIMIT
        );

        const walletBalanceAfter = await dai.balanceOf(owner.address);
        const expectedWalletBalance = (await walletBalance).sub(WeiPerEther.mul(500));

        const poolBalanceAfter = (await futureCash.getMarket(maturities[0])).totalLiquidity;
        const expectPoolBalance = poolBalance.add(WeiPerEther.mul(100));

        expect(walletBalanceAfter, "user wallet balance decreases").to.equal(expectedWalletBalance);
        expect(poolBalanceAfter, "pool increases by specified amount").to.equal(expectPoolBalance);

        expect(await t.isCollateralized(owner), "free collateral should not have changed").to.be.true;

        const escrowBalanceAfter = await escrow.cashBalances(CURRENCY.DAI, owner.address);
        const expectedEscrowBalance = escrowBalance.sub(WeiPerEther.mul(100));

        expect(escrowBalanceAfter, "user escrow balance decreases provided amount").to.equal(expectedEscrowBalance);
    });

    it.only("Remove Liquidity Tests", async () => {
        await t.setupLiquidity(owner, 0.5, WeiPerEther.mul(10));

        const poolBalance = (await futureCash.getMarket(maturities[0])).totalLiquidity;
        const escrowBalance = await escrow.cashBalances(CURRENCY.DAI, owner.address);

        await futureCash.removeLiquidity(maturities[0], WeiPerEther.mul(5), BLOCK_TIME_LIMIT);

        const poolBalanceAfter = (await futureCash.getMarket(maturities[0])).totalLiquidity;
        const expectedPoolBalance = poolBalance.sub(WeiPerEther.mul(5));

        const escrowBalanceAfter = await escrow.cashBalances(CURRENCY.DAI, owner.address);

        expect(poolBalanceAfter, "pool decreased by specified amount").to.equal(expectedPoolBalance);
        expect(escrowBalanceAfter.sub(escrowBalance), "user gets at least originally deposited amount").to.gte(0);

        expect(await t.isCollateralized(owner)).to.be.true;
        expect(await t.hasLiquidityToken(owner, maturities[0], WeiPerEther.mul(5), WeiPerEther.mul(5))).to.be.true;
    });
    it.only("Settle at maturity", async () => {
        await t.setupLiquidity();
        await escrow.connect(wallet2).depositEth({value: WeiPerEther.mul(8)});
        // wallet2 borrow 500
        await futureCash
            .connect(wallet2)
            .takeCurrentCash(maturities[0], WeiPerEther.mul(500), BLOCK_TIME_LIMIT, 60_000_000);
        await escrow.connect(wallet2).withdraw(dai.address, await escrow.cashBalances(CURRENCY.DAI, wallet2.address));

        await escrow.connect(wallet).deposit(dai.address, WeiPerEther.mul(100));
        // wallet lend 100
        await futureCash
            .connect(wallet)
            .takefCash(maturities[0], WeiPerEther.mul(100), BLOCK_TIME_LIMIT, MIN_IMPLIED_RATE);

        await fastForwardToMaturity(provider, maturities[1]);

        await portfolios.settleMaturedAssetsBatch([wallet.address, wallet2.address, owner.address]);

        expect(
            (await escrow.cashBalances(CURRENCY.DAI, owner.address)).add(
                await escrow.cashBalances(CURRENCY.DAI, owner.address)
            ),
            "liquidity provider has earned some interest on liquidity"
        ).to.be.above(WeiPerEther.mul(10_000));

        expect(
            await escrow.cashBalances(CURRENCY.DAI, wallet2.address),
            "the negative balance owed as a fixed rate loan"
        ).to.equal(WeiPerEther.mul(-500));

        expect(
            await escrow.cashBalances(CURRENCY.DAI, wallet.address),
            "the lending amount, should be above what they put in"
        ).to.be.above(WeiPerEther.mul(100));
    });
}).timeout(50000);
