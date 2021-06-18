require('dotenv').config()
const Web3 = require('web3')
const BigNumber = require('bignumber.js')

// Instantiate Web3 instance connected to NETWORK defined in .env
// NETWORK will be endpoint link, ie https://data-seed-prebsc-1-s1.binance.org:8545
async function init() {
  console.log('Connecting to ' + process.env.NETWORK)
  const web3 = new Web3(process.env.NETWORK)

  // Account stuff probably replaced by MetaMask
  const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY)
  web3.eth.accounts.wallet.add(account)
  web3.eth.defaultAccount = account.address

  return web3
}

// Gas Params
// TODO: Estimate gas
const gasLimit = "0x4C4B40"
const gasPrice = "0x4A817C800"
function gasOptions(web3) {
  return {
    from: web3.eth.defaultAccount,
    gasLimit: gasLimit,
    gasPrice: gasPrice,
  }
}

// ERC20 ABI
const tokenABI = require('../abi/IERC20.json')
// TODO: Check if there is existing allowance before attempting to send approval again
async function approve(tokenAddress, spenderAddress, amount, web3) {
  let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3)
  let contract = new web3.eth.Contract(tokenABI, tokenAddress)

  // BEP-20 required function
  let symbol = await contract.methods.symbol().call()

  await contract.methods.approve(spenderAddress, convertedAmount.toString()).send(gasOptions(web3)).on(
    'receipt', (receipt) => {
      console.log(symbol + ' approved.')
    }
  ).on(
    'error', (error, receipt) => {
      console.log(error)
      console.log(symbol + ' approval failed. Exiting...')
      process.exit()
    }
  )
}

// Returns a BigNumber, use toString to convert for methods calls
const ten = new BigNumber(10)
async function toAppropriateDecimals(tokenAddress, amount, web3) {
  let contract = new web3.eth.Contract(tokenABI, tokenAddress)
  // BEP-20 standard requires this method, ERC-20 however does not
  let decimals = await contract.methods.decimals().call()

  let power = ten.exponentiatedBy(decimals)
  let amountBN = new BigNumber(amount)
  return amountBN.multipliedBy(power)
}

module.exports = {
  init,
  gasOptions,
  approve,
  toAppropriateDecimals
}