require('dotenv').config()
let {gasOptions} = require('./utils')

// Escrow ABI
const escrowABI = require('../abi/Escrow.json')

const escrowAddress = process.env.ESCROW_ADDRESS

// Deposit BEP-20 tokens
// Amount should already be converted to appropriate decimals
async function deposit(tokenAddress, amount, web3) {
  let escrowContract = new web3.eth.Contract(escrowABI, escrowAddress)

  await escrowContract.methods.deposit(tokenAddress, amount).send(gasOptions(web3)).on(
    'receipt', function(receipt) {
      console.log('Deposit successful.')
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

// TODO: Required to allow BNB collateral deposits
async function depositBNB() {
  let escrowContract = new web3.eth.Contract(escrowABI, escrowAddress)

  // TODO: Need to put BNB amount in the msg.value
  await escrowContract.methods.depositEth().send(gasOptions(web3)).on(
    'receipt', function(receipt) {
      console.log('Deposit successful.')
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

// Withdraw BEP-20 tokens
// Amount should already be converted to appropriate decimals
async function withdraw(tokenAddress, amount, web3) {
  let escrowContract = new web3.eth.Contract(escrowABI, escrowAddress)

  await escrowContract.methods.withdraw(tokenAddress, amount).send(gasOptions(web3)).on(
    'receipt', function(receipt) {
      console.log('Withdraw successful.')
      console.log(receipt)
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Withdraw failed.')
      console.log(error)
      process.exit()
    }
  )
}

// TODO: Required to allow withdrawal of deposited BNB or withdrawal of borrowed BNB
async function withdrawBNB(amount) {
  let escrowContract = new web3.eth.Contract(escrowABI, escrowAddress)

  await escrowContract.methods.withdrawEth(amount).send(gasOptions(web3)).on(
    'receipt', function(receipt) {
      console.log('Withdraw successful.')
      console.log(receipt)
    }
  ).on(
    'error', function(error, receipt) {
      console.log('Withdraw failed.')
      console.log(error)
      process.exit()
    }
  )
}

module.exports = {
  deposit,
  withdraw,
}