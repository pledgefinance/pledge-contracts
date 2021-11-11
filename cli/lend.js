require("dotenv").config();

let {approve, init, gasOptions, toAppropriateDecimals} = require("./utils");
let {deposit} = require("./escrow");
let {batchOperation, constructDeposit, constructTrade} = require("./trade");
// let {singleLend} = require('./trade')

const marketABI = require("../abi/CashMarket.json");
const contracts = require("../bsc-test.json");

const marketAddress = process.env.MARKET_ADDRESS;
const escrowAddress = process.env.ESCROW_ADDRESS;
const daiAddress = process.env.DAI_ADDRESS;

// TODO: Find reasonable values
const maxTime = 4294967295;
const minImpliedRate = 0;

async function lend(
  marketAddress,
  escrowAddress,
  tokenAddress,
  amount,
  maturity,
  web3
) {
  await approve(tokenAddress, escrowAddress, amount, web3);
  await deposit(escrowAddress, tokenAddress, amount, web3);

  let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3);

  let marketContract = new web3.eth.Contract(marketABI, marketAddress);
  let fCash = await marketContract.methods
    .getfCashToCurrentCash(maturity, convertedAmount.toString())
    .call();

  await marketContract.methods
    .takefCash(maturity, fCash, maxTime, minImpliedRate)
    .send(gasOptions(web3))
    .on("receipt", function (receipt) {
      console.log("Lend successful.");
    })
    .on("error", function (error, receipt) {
      console.log("Lend failed.");
      console.log(error);
      process.exit();
    });
}

// async function testLend(tokenAddress, amount, maturity, web3) {
//   // await approve(tokenAddress, contracts.escrow, amount, web3)
//
//   let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3)
//   await singleLend(tokenAddress, convertedAmount, maturity, web3)
// }

// Lend function using ERC1155Trade contract batch operation
// const lendTradeType = 'TakefCash'
// async function batchLend(tokenAddress, amount, maturity, web3) {
//   // await approve(tokenAddress, escrowAddress, amount, web3)
//   let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3)
//
//   let deposit = constructDeposit(tokenAddress, convertedAmount)
//   let trade = constructTrade(lendTradeType, marketAddress, maturity, convertedAmount, minImpliedRate, 0, 0)
//
//   await batchOperation([deposit], [trade], [], maxTime, web3)
// }

// Test lend 5 DAI
const lendAmount = 5;
const maturity = 1632960000;

init().then((web3) => {
  lend(
    marketAddress,
    escrowAddress,
    daiAddress,
    lendAmount,
    maturity,
    web3
  ).then(() => {
    process.exit(0);
  });
});

module.exports = {
  lend,
};
