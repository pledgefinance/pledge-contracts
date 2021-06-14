require('dotenv').config()

let {init, gasOptions, approve, toAppropriateDecimals} = require('./utils')

const cashMarketJson = require('../abi/CashMarket.json')
const escrowJson = require('../abi/Escrow.json')

const cashMarketAddr = process.env.MARKET_ADDRESS
const escrowAddr = process.env.ESCROW_ADDRESS
const daiAddress = process.env.DAI_ADDRESS

// Random timeout value, set max uint32
const maxTime = 4294967295
// Check units for rate, value too big will cause transaction to fail
const minImpliedRate = 0

// Deposit collateral (not BNB)
// NOTE: BNB should work with the depositETH method
async function deposit(tokenAddress, amount, web3) {
  let escrowContract = new web3.eth.Contract(escrowJson, escrowAddr)

  let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3)

  await escrowContract.methods.deposit(tokenAddress, convertedAmount).send(gasOptions(web3)).on(
    'receipt', function(receipt) {
      console.log('Deposit successful')
      console.log(receipt)
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Deposit failed.')
      console.log(error)
      process.exit()
    }
  )
}

async function lend(tokenAddress, amount, maturity, web3) {
  let marketContract = new web3.eth.Contract(cashMarketJson, cashMarketAddr)

  let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3)
  // Check if this is the correct method
  let expectedfCash = await marketContract.methods.getCurrentCashTofCash(maturity, convertedAmount.toString()).call()

  // Returns amount of cash lent
  await marketContract.methods.takefCash(maturity, expectedfCash, maxTime, minImpliedRate).send(gasOptions(web3)).on(
    'receipt', function(receipt) {
      console.log(receipt)
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Lend tx failed.')
      console.log(error)
      process.exit()
    }
  )
}

// Test lend 5 DAI
const lendAmount = 5
const maturity = 1632960000

// TODO: Check if there is existing allowance before attempting to send approval again
init().then((web3) => {
  approve(daiAddress, escrowAddr, lendAmount, web3).then(() => {
    return deposit(daiAddress, lendAmount, web3)
  }).then(() => {
    return lend(daiAddress, lendAmount, maturity, web3)
  }).then(() => {
    process.exit(0)
  })
})
