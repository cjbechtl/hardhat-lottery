const { getNamedAccounts, ethers, network } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

developmentChains.includes(network.name)
	? describe.skip
	: describe("Raffle unit tests", () => {
			let raffle, raffleEntranceFee, deployer, interval;

			beforeEach(async () => {
				deployer = (await getNamedAccounts()).deployer;

				raffle = await ethers.getContract("Raffle", deployer);

				raffleEntranceFee = await raffle.getEntranceFee();
				interval = await raffle.getInterval();
			});

			describe("fulfillRandomWords", () => {
				it("works with live Chainlink keepers and Chainlink VRF, we get a random winner", async () => {
					const startingTimeStamp = await raffle.getLatestTimeStamp();
					const accounts = await ethers.getSigners();

					await new Promise(async (resolve, reject) => {
						raffle.once("WinnerPicked", async () => {
							console.log("Winner picked, event fired");

							try {
								const recentWinner =
									await raffle.getRecentWinner();
								const raffleState =
									await raffle.getRaffleState();
								const endingTimeStamp =
									await raffle.getLatestTimeStamp();
								const winnerEndingBalance =
									await accounts[1].getBalance();

								await expect(raffle.getPlayer(0)).to.be
									.reverted;

								assert.equal(
									recentWinner.toString(),
									accounts[0].address.toString()
								);

								assert.equal(raffleState, "0");

								assert.equal(
									winnerEndingBalance.toString(),
									winnerStartingBalance
										.add(raffleEntranceFee)
										.toString()
								);
								assert(endingTimeStamp > startingTimeStamp);
								resolve();
							} catch (e) {
								reject(e);
							}
							await raffle.enterRaffle({
								value: raffleEntranceFee,
							});
							const winnerStartingBalance =
								await accounts[0].getBalance();
						});
					});
				});
			});
	  });
