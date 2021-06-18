require('dotenv').config()

let {approve, init, gasOptions, toAppropriateDecimals} = require('./utils')
let {deposit} = require('./escrow')
// let {batchOperation, constructDeposit, constructTrade} = require('./trade')

const marketABI = require('../abi/CashMarket.json')

const marketAddress = process.env.MARKET_ADDRESS
const escrowAddress = process.env.ESCROW_ADDRESS
const daiAddress = process.env.DAI_ADDRESS

// TODO: Find reasonable values
const maxTime = 4294967295
const minImpliedRate = 0

async function lend(tokenAddress, amount, maturity, web3) {
  await approve(tokenAddress, escrowAddress, amount, web3)
  await deposit(tokenAddress, amount, web3)

  let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3)

  let marketContract = new web3.eth.Contract(marketABI, marketAddress)
  let fCash = await marketContract.methods.getfCashToCurrentCash(maturity, convertedAmount.toString()).call()

  await marketContract.methods.takefCash(maturity, fCash, maxTime, minImpliedRate).send(gasOptions(web3)).on(
    'receipt', function(receipt) {
      purchasedCash = receipt.events.TakeCurrentCash.returnValues.cash
      console.log('Lend successful.')
      console.log(receipt)
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Lend failed.')
      console.log(error)
      process.exit()
    }
  )
}

/* Lend function using ERC1155Trade contract batch operation
const lendTradeType = 'TakefCash'
async function lend(tokenAddress, amount, maturity, web3) {
  await approve(tokenAddress, escrowAddr, amount, web3)
  let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3)

  let deposit = constructDeposit(tokenAddress, convertedAmount)
  let trade = constructTrade(lendTradeType, cashMarketAddr, maturity, convertedAmount, minRate, 0, 0)

  await batchOperation([deposit], [trade], [], maxTime, web3)
}
*/

// Test lend 5 DAI
const lendAmount = 5
const maturity = 1632960000

init().then((web3) => {
  lend(daiAddress, lendAmount, maturity, web3).then(() => {
    process.exit(0)
  })
})
