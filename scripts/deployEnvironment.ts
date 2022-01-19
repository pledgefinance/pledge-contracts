import { Ierc1820Registry as IERC1820Registry } from "../typechain/Ierc1820Registry";
import { Iweth as IWETH } from "../typechain/Iweth";
import { Ierc20 as ERC20 } from "../typechain/Ierc20";
import { MockAggregator } from "../mocks/MockAggregator";
import { IAggregator } from "../typechain/IAggregator";

import WETHArtifact from "../mocks/WETH9.json";
import ERC1820RegistryArtifact from "../mocks/ERC1820Registry.json";
import MockDaiArtifact from "../mocks/MockDai.json";
import MockUSDCArtifact from "../mocks/MockUSDC.json";
import MockAggregatorArtfiact from "../mocks/MockAggregator.json";
import CreateProxyFactoryArtifact from "../build/CreateProxyFactory.json";
import Debug from "debug";
import { Wallet, Contract } from "ethers";
// import {WeiPerEther} from "ethers/constants";
import { Environment, NotionalDeployer } from "./NotionalDeployer";
import { parseEther, BigNumber } from "ethers/utils";
import { CreateProxyFactory } from "../typechain/CreateProxyFactory";

import { WeiPerEther } from "ethers/constants";
const log = Debug("test:deployEnvironment");

export async function deployTestEnvironment(
    deployWallet: Wallet,
    wethAddress: string,
    registryAddress: string,
    proxyFactoryAddress: string,
    confirmations: number
): Promise<Environment> {
    log("Deploying test environment");

    const dai = (await NotionalDeployer.deployContract(deployWallet, MockDaiArtifact, [], confirmations))
        .contract as ERC20;
    const usdc = (await NotionalDeployer.deployContract(deployWallet, MockUSDCArtifact, [], confirmations))
        .contract as ERC20;
    const btc = (await NotionalDeployer.deployContract(deployWallet, MockUSDCArtifact, [], confirmations))
        .contract as ERC20;
    const busd = (await NotionalDeployer.deployContract(deployWallet, MockUSDCArtifact, [], confirmations))
        .contract as ERC20;
    const plgr = (await NotionalDeployer.deployContract(deployWallet, MockDaiArtifact, [], confirmations))
        .contract as ERC20;

    const daiOracle = (await NotionalDeployer.deployContract(deployWallet, MockAggregatorArtfiact, [], confirmations))
        .contract as MockAggregator;
    await NotionalDeployer.txMined(daiOracle.setAnswer(parseEther("0.01")), confirmations);
    const usdcOracle = (await NotionalDeployer.deployContract(deployWallet, MockAggregatorArtfiact, [], confirmations))
        .contract as MockAggregator;
    await NotionalDeployer.txMined(usdcOracle.setAnswer(new BigNumber(0.01e6)), confirmations);

    const factory = await NotionalDeployer.deployContract(
        deployWallet,
        "PancakeFactory",
        [deployWallet.address],
        confirmations
    );

    const router = await NotionalDeployer.deployContract(
        deployWallet,
        "PancakeRouter",
        [factory.contract.address, wethAddress],
        confirmations
    );

    await factory.contract.createPair(btc.address, busd.address);

    const WETH = new Contract(wethAddress, WETHArtifact.abi, deployWallet) as IWETH;
    await WETH.deposit({ value: parseEther("200") });

    await WETH.approve(router.contract.address, WeiPerEther.mul(10000000000));
    await btc.approve(router.contract.address, WeiPerEther.mul(10000000000));
    await usdc.approve(router.contract.address, WeiPerEther.mul(10000000000));
    await busd.approve(router.contract.address, WeiPerEther.mul(10000000000));
    await dai.approve(router.contract.address, WeiPerEther.mul(10000000000));

    await router.contract.addLiquidity(
        wethAddress,
        busd.address,
        WeiPerEther.mul(100),
        WeiPerEther.mul(10000),
        1,
        1,
        deployWallet.address,
        0
    );

    await router.contract.addLiquidity(
        dai.address,
        busd.address,
        WeiPerEther.mul(100),
        "10000000000",
        1,
        1,
        deployWallet.address,
        0
    );

    await router.contract.addLiquidity(
        busd.address,
        dai.address,
        WeiPerEther.mul(1000),
        WeiPerEther.mul(1000),
        1,
        1,
        deployWallet.address,
        0
    );

    return {
        deploymentWallet: deployWallet,
        WETH: new Contract(wethAddress, WETHArtifact.abi, deployWallet) as IWETH,
        WBNB: new Contract(wethAddress, WETHArtifact.abi, deployWallet) as IWETH,
        ERC1820: new Contract(registryAddress, ERC1820RegistryArtifact.abi, deployWallet) as IERC1820Registry,
        DAI: dai,
        USDC: usdc,
        BTC: btc,
        BUSD: busd,
        PLGR: plgr,
        DAIETHOracle: daiOracle as unknown as IAggregator,
        USDCETHOracle: usdcOracle as unknown as IAggregator,
        BTCOracle: usdcOracle as unknown as IAggregator,
        BUSDOracle: usdcOracle as unknown as IAggregator,
        proxyFactory: new Contract(
            proxyFactoryAddress,
            CreateProxyFactoryArtifact.abi,
            deployWallet
        ) as CreateProxyFactory,
        RouterAddress: router.contract.address,
        Governace: deployWallet.address,
        plgrTotalPerDay: "3000",
        plgrLendRatio: "25",
        plgrborrowRatio: "30",
        plgrLiquidityRatio: "45",
    };
}

export async function deployLocal(deployWallet: Wallet): Promise<Environment> {
    log("Deploying to local environment");
    const weth = (await NotionalDeployer.deployContract(deployWallet, WETHArtifact, [], 1)).contract as IWETH;
    const registry = (await NotionalDeployer.deployContract(deployWallet, ERC1820RegistryArtifact, [], 1))
        .contract as IERC1820Registry;
    const proxyFactory = await deployProxyFactory(deployWallet, 1);

    return await deployTestEnvironment(deployWallet, weth.address, registry.address, proxyFactory.address, 1);
}

export async function deployProxyFactory(deployWallet: Wallet, confirmations: number) {
    const proxyFactory = (await NotionalDeployer.deployContract(deployWallet, "CreateProxyFactory", [], confirmations))
        .contract as CreateProxyFactory;

    return proxyFactory;
}
