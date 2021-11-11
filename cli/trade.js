require("dotenv").config();
let {gasOptions} = require("./utils");

// ERC1155Trade ABI
const tradeABI = require("../abi/ERC1155Trade.json");

const cashMarketAddress = process.env.MARKET_ADDRESS;
const tradeAddress = process.env.TRADE_ADDRESS;

const daiAddress = process.env.DAI_ADDRESS;
const usdcAddress = process.env.USDC_ADDRESS;

// Batch contract operations
async function batchOperation(deposits, trades, withdraws, maxTime, web3) {
  let tradeContract = new web3.eth.Contract(tradeABI, tradeAddress);

  // No withdraws -> batchOperation, Yes withdraws -> batchOperationWithdraw
  if (withdraws.length == 0) {
    await tradeContract.methods
      .batchOperation(web3.eth.defaultAccount, maxTime, deposits, trades)
      .send(gasOptions(web3))
      .on("receipt", function (receipt) {
        console.log("batchOperation successful");
        console.log(receipt);
      })
      .on("error", function (error, receipt) {
        console.log("batchOperation failed.");
        console.log(error);
        process.exit();
      });
  } else {
    await tradeContract.methods
      .batchOperationWithdraw(
        web3.eth.defaultAccount,
        maxTime,
        deposits,
        trades,
        withdraws
      )
      .send(gasOptions(web3))
      .on("receipt", function (receipt) {
        console.log("batchOperationWithdraw successful");
        console.log(receipt);
      })
      .on("error", function (error, receipt) {
        console.log("batchOperationWithdraw failed.");
        console.log(error);
        process.exit();
      });
  }
}

// TEMP: Hardcoded mapping (BSC Testnet)
const currencyIDMap = new Map();
currencyIDMap.set(daiAddress, 1);
currencyIDMap.set(usdcAddress, 2);
// TODO: Currency ID map should be moved into the backend
// TODO: Figure out how native ETH works here
// Amount should already have been converted to appropriate decimals
function constructDeposit(tokenAddress, amount) {
  return {
    currencyID: currencyIDMap.get(tokenAddress),
    amount: amount,
  };
}

// TEMP: EnumMap
const tradeTypeEnumMap = new Map();
tradeTypeEnumMap.set("TakeCurrentCash", 0);
tradeTypeEnumMap.set("TakefCash", 1);
tradeTypeEnumMap.set("AddLiquidity", 2);
tradeTypeEnumMap.set("RemoveLiquidity", 3);
// TEMP: cashGroupIDMap based on CashMarket contract address
// Only working with 1 pool for now
const cashGroupIDMap = new Map();
cashGroupIDMap.set(cashMarketAddress, 1);
// TODO: Cash Group Map should also be moved into the backend
// Amount should already have been converted to appropriate decimals
function constructTrade(
  tradeType,
  marketAddress,
  maturity,
  amount,
  minRate,
  maxRate,
  maxfCash
) {
  return {
    tradeType: tradeTypeEnumMap.get(tradeType),
    cashGroup: cashGroupIDMap.get(marketAddress),
    maturity: maturity,
    amount: amount,
    slippageData: constructSlippage(tradeType, minRate, maxRate, maxfCash),
  };
}

// TODO: Figure out byte encoding for each type of trade
// If no input, contract will assume MIN & MAX for each value
function constructSlippage(tradeType, minRate, maxRate, maxfCash) {
  switch (tradeTypeEnumMap.get(tradeType)) {
    case 0:
      // TakeCurrentCash needs MaxRate
      return "0x0";
    case 1:
      // TakefCase needs MinRate
      return "0x0";
    case 2:
      // AddLiquidity needs MinRate, MaxRate, (opt) MaxfCash
      return "0x0";
    case 3:
      // RemoveLiquidity does not use slippageData
      return "0x0";
  }
}

// Amount should already be converted
// NOTE: Amount can be 0 to indicate withdraw all
function constructWithdraw(account, tokenAddress, amount) {
  return {
    to: account,
    currencyID: currencyIDMap.get(tokenAddress),
    amount: amount,
  };
}

module.exports = {
  batchOperation,
  constructDeposit,
  constructTrade,
  constructWithdraw,
};
