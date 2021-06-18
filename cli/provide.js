require('dotenv').config()

let {init, gasOptions, approve, toAppropriateDecimals} = require('./utils')
let {deposit} = require('./escrow')

const marketABI = require('../abi/CashMarket.json')

const marketAddress = process.env.MARKET_ADDRESS
const escrowAddress = process.env.ESCROW_ADDRESS
const daiAddress = process.env.DAI_ADDRESS

// TODO: Figure out slippage numbers later
const maxTime = 4294967295
const minImpliedRate = 0
const maxImpliedRate = 4294967295

async function provide(tokenAddress, amount, maturity, web3) {
  let marketContract = new web3.eth.Contract(marketABI, marketAddress)

  await approve(tokenAddress, escrowAddress, amount, web3)
  await deposit(tokenAddress, amount, web3)

  let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3)
  let fCashMax = await marketContract.methods.getCurrentCashTofCash(maturity, convertedAmount.toString()).call() + 1

  await marketContract.methods.addLiquidity(maturity, convertedAmount.toString(), fCashMax, minImpliedRate, maxImpliedRate, maxTime).send(gasOptions(web3)).on(
    'receipt', function(receipt) {
      console.log('Provide liquidity successful')
      console.log(receipt)
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Provide liquidity failed.')
      console.log(error)
      process.exit()
    }
  )
}

// Test provide 5 DAI
const provideAmount = 5
const maturity = 1632960000

init(process.env.PRIVATE_KEY).then((web3) => {
  provide(daiAddress, provideAmount, maturity, web3).then(() => {
    process.exit(0)
  })
})
