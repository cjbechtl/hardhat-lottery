require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

const GORELI_RPC_URL = process.env.GORELI_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const CMC_API_KEY = process.env.CMC_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity: {
		compilers: [{ version: "0.8.9" }, { version: "0.8.4" }],
	},
	defaultNetwork: "hardhat",
	networks: {
		goerli: {
			url: GORELI_RPC_URL,
			accounts: [PRIVATE_KEY],
			chainId: 5,
			blockConfirmations: 6,
		},
		hardhat: {
			chainId: 31337,
			blockConfirmations: 1,
		},
	},
	etherscan: {
		apiKey: ETHERSCAN_API_KEY,
	},
	// gasReporter: {
	// 	enabled: true,
	// 	outputFile: "gas-report.txt",
	// 	noColors: true,
	// 	currency: "USD",
	// 	coinmarketcap: CMC_API_KEY,
	// 	token: "ETH",
	// },
	namedAccounts: {
		deployer: {
			default: 0,
		},
		player: {
			default: 1,
		},
	},
	mocha: {
		timeout: 300000,
	},
};
