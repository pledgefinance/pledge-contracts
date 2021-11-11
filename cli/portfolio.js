require("dotenv").config();

// Portfolio ABI
const portfolioABI = require("../abi/Portfolios.json");

const portfolioAddress = process.env.PORTFOLIO_ADDRESS;

// Asset Struct
// 0x98 - fCash Payer (Negative)
// 0xa8 - fCash Receiver
// Notional - fCash in wei
async function getAssets(address, web3) {
  let portfolioContract = new web3.eth.Contract(portfolioABI, portfolioAddress);
  let assets = await portfolioContract.methods.getAssets(address).call();

  return assets;
}

async function getCashGroup(cashGroupID, web3) {
  let portfolioContract = new web3.eth.Contract(portfolioABI, portfolioAddress);
  let cashGroup = await portfolioContract.methods
    .getCashGroup(cashGroupID)
    .call();

  return cashGroup;
}

module.exports = {
  getAssets,
  getCashGroup,
};
