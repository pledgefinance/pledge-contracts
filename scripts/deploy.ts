import { Contract, Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { NotionalDeployer, Environment } from "./NotionalDeployer";
import { BigNumber, parseEther } from "ethers/utils";
import { config } from "dotenv";
import { WeiPerEther } from "ethers/constants";
import Debug from "debug";
import { deployLocal } from "./deployEnvironment";
import path from "path";

import WETHArtifact from "../mocks/WETH9.json";
import ERC1820RegistryArtifact from "../mocks/ERC1820Registry.json";
import CreateProxyFactoryArtifact from "../build/CreateProxyFactory.json";
import MockDaiArtifact from "../mocks/MockDai.json";
import MockUSDCArtifact from "../mocks/MockUSDC.json";
import MockAggregatorArtifact from "../mocks/MockAggregator.json";

import { Ierc1820Registry as IERC1820Registry } from "../typechain/Ierc1820Registry";
import { Iweth as IWETH } from "../typechain/Iweth";
import { Ierc20 as ERC20 } from "../typechain/Ierc20";
import { IAggregator } from "../typechain/IAggregator";
import { CreateProxyFactory } from "../typechain/CreateProxyFactory";
import { RetryProvider } from "./RetryProvider";

const log = Debug("notional:deploy");
const ONE_MONTH = 2592000;
const BASIS_POINT = 1e5;

async function main() {
    const envPath = `${process.env.DOTENV_CONFIG_PATH}`;
    log(`Loading enviromnent from ${envPath} from ${process.cwd()}`);
    config({ path: envPath });

    const chainId = process.env.DEPLOY_CHAIN_ID as string;
    let environment: Environment;
    let deployWallet: Wallet;
    let confirmations: number;

    switch (chainId) {
        // Local Ganache
        case "1337":
            deployWallet = new Wallet(
                process.env.TESTNET_PRIVATE_KEY as string,
                new JsonRpcProvider(process.env.TESTNET_PROVIDER)
            );
            console.log(deployWallet.address);
            environment = await deployLocal(deployWallet);
            confirmations = 1;
            break;
        case "97":
            confirmations = 3;
            deployWallet = new Wallet(
                process.env.TESTNET_PRIVATE_KEY as string,
                new RetryProvider(3, process.env.TESTNET_PROVIDER)
            );

            environment = {
                deploymentWallet: deployWallet,
                WETH: new Contract(process.env.WETH_ADDRESS as string, WETHArtifact.abi, deployWallet) as IWETH,
                WBNB: new Contract(process.env.WETH_ADDRESS as string, WETHArtifact.abi, deployWallet) as IWETH,
                ERC1820: new Contract(
                    process.env.ERC1820_REGISTRY_ADDRESS as string,
                    ERC1820RegistryArtifact.abi,
                    deployWallet
                ) as IERC1820Registry,
                DAI: new Contract(process.env.DAI_ADDRESS as string, MockDaiArtifact.abi, deployWallet) as ERC20,
                USDC: new Contract(process.env.USDC_ADDRESS as string, MockUSDCArtifact.abi, deployWallet) as ERC20,
                BTC: new Contract(process.env.BTC_ADDRESS as string, MockUSDCArtifact.abi, deployWallet) as ERC20,
                BUSD: new Contract(process.env.BUSD_ADDRESS as string, MockUSDCArtifact.abi, deployWallet) as ERC20,
                PLGR: new Contract(process.env.PLGR_ADDRESS as string, MockUSDCArtifact.abi, deployWallet) as ERC20,
                DAIETHOracle: new Contract(
                    process.env.DAI_ORACLE as string,
                    MockAggregatorArtifact.abi,
                    deployWallet
                ) as IAggregator,
                USDCETHOracle: new Contract(
                    process.env.USDC_ORACLE as string,
                    MockAggregatorArtifact.abi,
                    deployWallet
                ) as IAggregator,
                BTCOracle: new Contract(
                    process.env.BTC_ORACLE as string,
                    MockAggregatorArtifact.abi,
                    deployWallet
                ) as IAggregator,
                BUSDOracle: new Contract(
                    process.env.BUSD_ORACLE as string,
                    MockAggregatorArtifact.abi,
                    deployWallet
                ) as IAggregator,
                proxyFactory: new Contract(
                    process.env.PROXY_FACTORY as string,
                    CreateProxyFactoryArtifact.abi,
                    deployWallet
                ) as CreateProxyFactory,
                RouterAddress: process.env.PANCAKE_ROUTER,
                Governace: process.env.AIRDROP_GOVERNACE,
                plgrTotalPerDay: process.env.PLGR_EARN_TOTAL_PER_DAY as string,
                plgrLendRatio: process.env.PLGR_EARN_LEND_RATIO as string,
                plgrborrowRatio: process.env.PLGR_EARN_BORROW_RATIO as string,
                plgrLiquidityRatio: process.env.PLGR_EARN_LIQUIDITY_RATIO as string
            };
            break;
        case "56":
            confirmations = 3;
            deployWallet = new Wallet(
                process.env.TESTNET_PRIVATE_KEY as string,
                new RetryProvider(3, process.env.TESTNET_PROVIDER)
            );
            environment = {
                deploymentWallet: deployWallet,
                WETH: new Contract(process.env.WETH_ADDRESS as string, WETHArtifact.abi, deployWallet) as IWETH,
                WBNB: new Contract(process.env.WETH_ADDRESS as string, WETHArtifact.abi, deployWallet) as IWETH,
                ERC1820: new Contract(
                    process.env.ERC1820_REGISTRY_ADDRESS as string,
                    ERC1820RegistryArtifact.abi,
                    deployWallet
                ) as IERC1820Registry,
                DAI: new Contract(process.env.DAI_ADDRESS as string, MockDaiArtifact.abi, deployWallet) as ERC20,
                USDC: new Contract(process.env.USDC_ADDRESS as string, MockUSDCArtifact.abi, deployWallet) as ERC20,
                BTC: new Contract(process.env.BTC_ADDRESS as string, MockUSDCArtifact.abi, deployWallet) as ERC20,
                BUSD: new Contract(process.env.BUSD_ADDRESS as string, MockUSDCArtifact.abi, deployWallet) as ERC20,
                PLGR: new Contract(process.env.PLGR_ADDRESS as string, MockUSDCArtifact.abi, deployWallet) as ERC20,
                DAIETHOracle: new Contract(
                    process.env.DAI_ORACLE as string,
                    MockAggregatorArtifact.abi,
                    deployWallet
                ) as IAggregator,
                USDCETHOracle: new Contract(
                    process.env.USDC_ORACLE as string,
                    MockAggregatorArtifact.abi,
                    deployWallet
                ) as IAggregator,
                BTCOracle: new Contract(
                    process.env.BTC_ORACLE as string,
                    MockAggregatorArtifact.abi,
                    deployWallet
                ) as IAggregator,
                BUSDOracle: new Contract(
                    process.env.BUSD_ORACLE as string,
                    MockAggregatorArtifact.abi,
                    deployWallet
                ) as IAggregator,
                proxyFactory: new Contract(
                    process.env.PROXY_FACTORY as string,
                    CreateProxyFactoryArtifact.abi,
                    deployWallet
                ) as CreateProxyFactory,
                RouterAddress: process.env.PANCAKE_ROUTER,
                Governace: process.env.AIRDROP_GOVERNACE,
                plgrTotalPerDay: process.env.PLGR_EARN_TOTAL_PER_DAY as string,
                plgrLendRatio: process.env.PLGR_EARN_LEND_RATIO as string,
                plgrborrowRatio: process.env.PLGR_EARN_BORROW_RATIO as string,
                plgrLiquidityRatio: process.env.PLGR_EARN_LIQUIDITY_RATIO as string
            };
            break;
        default:
            log(`Unknown chain id: ${chainId}, quitting`);
            process.exit(1);
    }

    console.log("Deploying");
    const notional = await NotionalDeployer.deploy(
        environment.deploymentWallet,
        environment,
        new BigNumber(8),
        parseEther("1.06"),
        parseEther("1.02"),
        parseEther("0.80"),
        parseEther("1.01"),
        parseEther("0.50"),
        parseEther("0.95"),
        confirmations
    );

    console.log("DAI");
    // List currencies
    const daiId = await notional.listCurrency(
        environment.DAI.address,
        environment.DAIETHOracle,
        parseEther("1.4"),
        false,
        false,
        WeiPerEther,
        false
    );

    console.log("USDC");
    const usdcId = await notional.listCurrency(
        environment.USDC.address,
        environment.USDCETHOracle,
        parseEther("1.4"),
        false,
        false,
        WeiPerEther,
        false
    );
    log(usdcId);

    console.log("BTC");
    const btcId = await notional.listCurrency(
        environment.BTC.address,
        environment.BTCOracle,
        parseEther("1.4"),
        false,
        false,
        WeiPerEther,
        false
    );
    log(btcId);

    console.log("BUSD");
    const busdId = await notional.listCurrency(
        environment.BUSD.address,
        environment.BUSDOracle,
        parseEther("1.4"),
        false,
        false,
        WeiPerEther,
        false
    );
    log(busdId);

    // deploy cash markets
    console.log("currency cash market deploying...");
    console.log("DAI cash market");
    await notional.deployCashMarket(
        daiId,
        2,
        ONE_MONTH,
        parseEther("1000"),
        new BigNumber(2.5 * BASIS_POINT),
        new BigNumber(0), // 2/100 * 1e18 (2%)
        1_030_000_000,
        85
    );
    console.log("USDC cash market");
    await notional.deployCashMarket(
        usdcId,
        2,
        ONE_MONTH,
        parseEther("1000"),
        new BigNumber(2.5 * BASIS_POINT),
        new BigNumber(0), // 2/100 * 1e18 (2%)
        1_030_000_000,
        85
    );
    console.log("BTC cash market");
    await notional.deployCashMarket(
        btcId,
        2,
        ONE_MONTH,
        parseEther("1000"),
        new BigNumber(2.5 * BASIS_POINT),
        new BigNumber(0), // 2/100 * 1e18 (2%)
        1_030_000_000,
        85
    );
    console.log("BUSD cash market");
    await notional.deployCashMarket(
        busdId,
        2,
        ONE_MONTH,
        parseEther("1000"),
        new BigNumber(2.5 * BASIS_POINT),
        new BigNumber(0), // 2/100 * 1e18 (2%)
        1_030_000_000,
        85
    );

    const outputFile = path.join(__dirname, ("../" + process.env.CONTRACTS_FILE) as string);
    await notional.saveAddresses(outputFile);
    await notional.transferOwner(process.env.TRANSFER_OWNER_PUBLIC_KEY as string);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
