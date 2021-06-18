require('dotenv').config()

let {init, gasOptions, toAppropriateDecimals} = require('./utils')

const marketABI = require('../abi/CashMarket.json')

const marketAddress = process.env.MARKET_ADDRESS
const daiAddress = process.env.DAI_ADDRESS

// Random timeout value
const maxTime = 4294967295

async function remove(tokenAddr, amount, maturity, web3) {
  let marketContract = new web3.eth.Contract(marketABI, marketAddress)

  let convertedAmount = await toAppropriateDecimals(tokenAddr, amount, web3)

  // Returns amount of cash claimed from burning liquidity token
  await marketContract.methods.removeLiquidity(maturity, convertedAmount, maxTime).send(gasOptions(web3)).on(
    'receipt', function(receipt) {
      console.log('Remove liquidity successful')
      console.log(receipt)
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Remove liquidity failed.')
      console.log(error)
      process.exit()
    }
  )
}

// Test remove 5 DAI
const removeAmount = 5
const maturity = 1632960000

init(process.env.PRIVATE_KEY).then((web3) => {
  remove(daiAddress, removeAmount, maturity, web3).then(() => {
    process.exit(0)
  })
})
