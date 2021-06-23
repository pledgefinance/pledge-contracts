require('dotenv').config()

const marketABI = require('../abi/CashMarket.json')

const marketAddress = process.env.MARKET_ADDRESS

async function getRate(maturity, web3) {
  let marketContract = new web3.eth.Contract(marketABI, marketAddress)
  let rate = await marketContract.methods.getRate(maturity).call()

  return rate
}

async function getActiveMaturities(web3) {
  let marketContract = new web3.eth.Contract(marketABI, marketAddress)
  let maturities = await marketContract.methods.getActiveMaturities().call()

  return maturities
}

async function getMarket(maturity, web3) {
  let marketContract = new web3.eth.Contract(marketABI, marketAddress)
  let market = await marketContract.methods.getMarket(maturity).call()

  return market
}

module.exports = {
  getRate,
  getActiveMaturities,
  getMarket
}