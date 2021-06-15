require('dotenv').config()

let {init, gasOptions, approve, toAppropriateDecimals} = require('./utils')

const cashMarketJson = require('../abi/CashMarket.json')
const escrowJson = require('../abi/Escrow.json')

const cashMarketAddr = process.env.MARKET_ADDRESS
const escrowAddr = process.env.ESCROW_ADDRESS
const daiAddress = process.env.DAI_ADDRESS

// Deposit liquidity (not BNB)
// NOTE: BNB should work with the depositETH method?
// TODO: Pull function into escrow utils to reduce duplication later
async function deposit(tokenAddress, amount, web3) {
  let escrowContract = new web3.eth.Contract(escrowJson, escrowAddr)

  let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3)

  await escrowContract.methods.deposit(tokenAddress, convertedAmount).send(gasOptions(web3)).on(
    'receipt', function (receipt) {
      console.log('Deposit successful')
      console.log(receipt)
    }
  ).on(
    'error', function (error, receipt) {
      console.log('Deposit failed.')
      console.log(error)
      process.exit()
    }
  )
}


// TODO: Figure out what these numbers should look like
// BSC has essentially instant finality (3 second), so we can most likely ignore slippage
const maxTime = 4294967295
const minImpliedRate = 0
const maxImpliedRate = 4294967295

async function provide(tokenAddr, amount, maturity, web3) {
  let marketContract = new web3.eth.Contract(cashMarketJson, cashMarketAddr)

  let convertedAmount = await toAppropriateDecimals(tokenAddr, amount, web3)
  // Add 1 for maxfCash param
  let expectedfCash = await marketContract.methods.getCurrentCashTofCash(maturity, convertedAmount.toString()).call() + 1

  await marketContract.methods.addLiquidity(maturity, convertedAmount.toString(), expectedfCash, minImpliedRate, maxImpliedRate, maxTime).send(gasOptions(web3)).on(
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

// Test provide 5 DAI
const provideAmount = 5
const maturity = 1632960000

init(process.env.PRIVATE_KEY).then((web3) => {
  approve(daiAddress, escrowAddr, provideAmount, web3).then(() => {
    // TODO: If deposit succeeds, don't deposit again
    return deposit(daiAddress, provideAmount, web3)
  }).then(() => {
    return provide(daiAddress, provideAmount, maturity, web3)
  }).then(() => {
    process.exit(0)
  })
})
