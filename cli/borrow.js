require('dotenv').config()

let init = require('./initialize')

const cashMarketJson = require('../abi/CashMarket.json')
const escrowJson = require('../abi/Escrow.json')
const tokenJson = require('../abi/IERC20.json')

const cashMarketAddr = '0x56fe9b91db8d72d6660ad4623459ccb72095cd4b'
const escrowAddr = '0x983cb0b10cB6e590F968eB9095c156d655172b9D'
const daiAddress = '0x924734415c6a64b20f7c5dda91917842ae8b52e3'
const usdcAddress = '0xf95665aa5af19bb2b5e72787b3419a41085c96cd'

// Gas Params
const gasLimit = "0x4C4B40"
const gasPrice = "0x4A817C800"

// Approve collateral token
async function approveToken(tokenAddr, amount, web3) {
  let tokenContract = new web3.eth.Contract(tokenJson, tokenAddr)

  // Do actual decimals calculation
  await tokenContract.methods.approve(escrowAddr, web3.utils.toWei(amount.toString())).send({from: web3.eth.defaultAccount, gasLimit: gasLimit, gasPrice: gasPrice}).on(
    'receipt', function(receipt) {
      console.log('Token (' + tokenAddr + ') approved for ' + amount)
      console.log(receipt)
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Token approval failed.')
      console.log(error)
      process.exit()
    }
  )
}

// Deposit collateral (not BNB)
// NOTE: BNB should work with the depositETH method
async function depositCollateral(tokenAddr, amount, web3) {
  let escrowContract = new web3.eth.Contract(escrowJson, escrowAddr)

  await escrowContract.methods.deposit(tokenAddr, web3.utils.toWei(amount.toString())).send({from: web3.eth.defaultAccount, gasLimit: gasLimit, gasPrice: gasPrice}).on(
    'receipt', function(receipt) {
      console.log('Token (' + tokenAddr + ') approved for ' + amount)
      console.log(receipt)
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Token approval failed.')
      console.log(error)
      process.exit()
    }
  )
}

// Random timeout value, set max uint32
const maxTime = 4294967295
// Check units for rate, this value will cause the trade to fail if the slippage is too high
// TEMP: max uint32
const maxImpliedRate = 4294967295

async function borrow(tokenAddr, amount, maturity, web3) {
  let marketContract = new web3.eth.Contract(cashMarketJson, cashMarketAddr)

  // Is this the correct method?
  let requiredfCash = await marketContract.methods.getCurrentCashTofCash(maturity, web3.utils.toWei(amount.toString())).call()
  console.log(requiredfCash)

  // Returns amount of cash purchased
  // Need to try to find the value, could fake success message with inputted amount
  await marketContract.methods.takeCurrentCash(maturity, requiredfCash, maxTime, maxImpliedRate).send({from: web3.eth.defaultAccount, gasLimit: gasLimit, gasPrice: gasPrice}).on(
    'receipt', function(receipt) {
      console.log(receipt)
      let fCash = receipt.events.TakeCurrentCash.returnValues.fCash
      let cCash = receipt.events.TakeCurrentCash.returnValues.cash
      console.log('Interest Rate: ' + (fCash - cCash))
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Borrow tx failed.')
      console.log(error)
      process.exit()
    }
  )
}

// Test 3 USDC collat for 1 DAI
const collatAmount = 3
const desiredAmount = 1

// Unix timestamp of maturity end date, get from portfolio data
const maturity = 1632960000

init(process.env.PRIVATE_KEY).then((web3) => {
  approveToken(usdcAddress, collatAmount, web3).then(() => {
    return depositCollateral(usdcAddress, collatAmount, web3)
  }).then(() => {
    return borrow(daiAddress, desiredAmount, maturity, web3)
  }).then(() => {
    process.exit(0)
  })
})
