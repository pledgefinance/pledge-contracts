require("dotenv").config();

let {approve, init, gasOptions, toAppropriateDecimals} = require("./utils");
let {deposit, withdraw} = require("./escrow");

const marketABI = require("../abi/CashMarket.json");

const marketAddress = process.env.MARKET_ADDRESS;
const escrowAddress = process.env.ESCROW_ADDRESS;
const daiAddress = process.env.DAI_ADDRESS;
const usdcAddress = process.env.USDC_ADDRESS;

// TODO: Find reasonable values
const maxTime = 4294967295;
const maxImpliedRate = 4294967295;

async function borrow(
  marketAddress,
  escrowAddress,
  collatAddress,
  collatAmount,
  purchaseAddress,
  purchaseAmount,
  maturity,
  web3
) {
  await approve(collatAddress, escrowAddress, collatAmount, web3);
  await deposit(escrowAddress, collatAddress, collatAmount, web3);

  let convertedAmount = await toAppropriateDecimals(
    purchaseAddress,
    purchaseAmount,
    web3
  );

  let marketContract = new web3.eth.Contract(marketABI, marketAddress);
  // FIXME: End purchased cash =/= inputted amount
  let fCashRequired = await marketContract.methods
    .getCurrentCashTofCash(maturity, convertedAmount.toString())
    .call();

  let purchasedCash;
  await marketContract.methods
    .takeCurrentCash(maturity, fCashRequired, maxTime, maxImpliedRate)
    .send(gasOptions(web3))
    .on("receipt", function (receipt) {
      purchasedCash = receipt.events.TakeCurrentCash.returnValues.cash;
      console.log("Borrow successful.");
    })
    .on("error", function (error, receipt) {
      console.log("Borrow failed.");
      console.log(error);
      process.exit();
    });

  await withdraw(purchaseAddress, purchasedCash, web3);
}

// Test 3 USDC collat for 1 DAI
const collatAmount = 3;
const purchaseAmount = 1;

// Unix timestamp of maturity end date, get from portfolio data
const maturity = 1632960000;

init(process.env.PRIVATE_KEY).then((web3) => {
  borrow(
    marketAddress,
    escrowAddress,
    usdcAddress,
    collatAmount,
    daiAddress,
    purchaseAmount,
    maturity,
    web3
  ).then(() => {
    process.exit(0);
  });
});

module.exports = {
  borrow,
};
