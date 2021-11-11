require("dotenv").config();
let {gasOptions, toAppropriateDecimals} = require("./utils");

// Escrow ABI
const escrowABI = require("../abi/Escrow.json");

const escrowAddress = process.env.ESCROW_ADDRESS;

// Deposit BEP-20 tokens
async function deposit(escrowAddress, tokenAddress, amount, web3) {
  let convertedAmount = await toAppropriateDecimals(tokenAddress, amount, web3);

  let escrowContract = new web3.eth.Contract(escrowABI, escrowAddress);
  await escrowContract.methods
    .deposit(tokenAddress, convertedAmount.toString())
    .send(gasOptions(web3))
    .on("receipt", function (receipt) {
      console.log("Deposit successful.");
    })
    .on("error", function (error, receipt) {
      console.log("Deposit failed.");
      console.log(error);
      process.exit();
    });
}

// TODO: Required to allow BNB collateral deposits
// TODO: Decimal conversion for BNB
async function depositBNB(amount) {
  let escrowContract = new web3.eth.Contract(escrowABI, escrowAddress);
  // TODO: Need to put BNB amount in the msg.value
  await escrowContract.methods
    .depositEth()
    .send(gasOptions(web3))
    .on("receipt", function (receipt) {
      console.log("Deposit successful.");
    })
    .on("error", function (error, receipt) {
      console.log("Deposit failed.");
      console.log(error);
      process.exit();
    });
}

// Withdraw BEP-20 tokens
// NOTE: Amount should already be converted for this function only
async function withdraw(tokenAddress, amount, web3) {
  let escrowContract = new web3.eth.Contract(escrowABI, escrowAddress);
  await escrowContract.methods
    .withdraw(tokenAddress, amount)
    .send(gasOptions(web3))
    .on("receipt", function (receipt) {
      console.log("Withdraw successful.");
    })
    .on("error", function (error, receipt) {
      console.log("Withdraw failed.");
      console.log(error);
      process.exit();
    });
}

// TODO: Required to allow withdrawal of deposited BNB or withdrawal of borrowed BNB
async function withdrawBNB(amount) {
  let escrowContract = new web3.eth.Contract(escrowABI, escrowAddress);

  await escrowContract.methods
    .withdrawEth(amount)
    .send(gasOptions(web3))
    .on("receipt", function (receipt) {
      console.log("Withdraw successful.");
    })
    .on("error", function (error, receipt) {
      console.log("Withdraw failed.");
      console.log(error);
      process.exit();
    });
}

module.exports = {
  deposit,
  withdraw,
};
