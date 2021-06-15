require('dotenv').config()

let {init, gasOptions, approve, toAppropriateDecimals} = require('./utils')

const cashMarketJson = require('../abi/CashMarket.json')

const cashMarketAddr = process.env.MARKET_ADDRESS
const daiAddress = process.env.DAI_ADDRESS

// No approval required

// Random timeout value (assumed seconds)
// Could be block
const maxTime = 4294967295

async function remove(tokenAddr, amount, maturity, web3) {
  let marketContract = new web3.eth.Contract(cashMarketJson, cashMarketAddr)

  let convertedAmount = await toAppropriateDecimals(tokenAddr, amount, web3)

  // Returns amount of cash claimed from burning liquidity token
  await marketContract.methods.removeLiquidity(maturity, convertedAmount, maxTime).send(gasOptions(web3)).on(
    'receipt', function(receipt) {
      console.log('Withdrawal successful')
      console.log(receipt)
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Withdrawal failed.')
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
