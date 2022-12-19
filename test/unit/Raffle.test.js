const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const {
	developmentChains,
	networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
	? describe.skip
	: describe("Raffle unit tests", () => {
			let raffle,
				vrfCoordinatorV2Mock,
				raffleEntranceFee,
				deployer,
				interval,
				subscriptionId;
			const chainId = network.config.chainId;

			beforeEach(async () => {
				deployer = (await getNamedAccounts()).deployer;
				await deployments.fixture(["all"]);
				raffle = await ethers.getContract("Raffle", deployer);
				vrfCoordinatorV2Mock = await ethers.getContract(
					"VRFCoordinatorV2Mock",
					deployer
				);
				subscriptionId = await raffle.getSubscriptionId();
				await vrfCoordinatorV2Mock.addConsumer(
					subscriptionId,
					raffle.address
				);
				raffleEntranceFee = await raffle.getEntranceFee();
				interval = await raffle.getInterval();
			});

			describe("constructor", () => {
				it("initializes the raffle correctly", async () => {
					const raffleState = await raffle.getRaffleState();

					assert.equal(raffleState.toString(), "0");
					assert.equal(
						interval.toString(),
						networkConfig[chainId]["interval"]
					);
				});
			});

			describe("enterRaffle", () => {
				it("reverts when you don't pay enough", async () => {
					await expect(
						raffle.enterRaffle()
					).to.be.revertedWithCustomError(
						raffle,
						"Raffle__NotEnoughEthEntered"
					);
				});

				it("records players when they enter", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					const playerFromContract = await raffle.getPlayer(0);
					assert.equal(playerFromContract, deployer);
				});

				it("emits event on enter ", async () => {
					await expect(
						raffle.enterRaffle({ value: raffleEntranceFee })
					).to.emit(raffle, "RaffleEntered");
				});

				it("doesn't allow entrance when raffle is calculating", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					]);
					await network.provider.send("evm_mine", []);
					// pretend to be a chainlink keeper
					await raffle.performUpkeep([]);
					await expect(
						raffle.enterRaffle({ value: raffleEntranceFee })
					).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen");
				});
			});

			describe("checkUpkeep", () => {
				it("returns false if people haven't sent any eth", async () => {
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					]);
					await network.provider.send("evm_mine", []);
					const { upkeepNeeded } =
						await raffle.callStatic.checkUpkeep([]);
					assert(!upkeepNeeded);
				});

				it("returns false if raffle isn't open", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					]);
					await network.provider.send("evm_mine", []);
					await raffle.performUpkeep("0x");
					const { upkeepNeeded } =
						await raffle.callStatic.checkUpkeep([]);
					assert(!upkeepNeeded);
				});
				it("returns false if enough time hasn't passed", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() - 5,
					]); // use a higher number here if this test fails
					await network.provider.send("evm_mine", []);
					const { upkeepNeeded } =
						await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
					assert(!upkeepNeeded);
				});
				it("returns true if enough time has passed, has players, eth, and is open", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					]);
					await network.provider.send("evm_mine", []);
					const { upkeepNeeded } =
						await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
					assert(upkeepNeeded);
				});
			});

			describe("performUpkeep", () => {
				it("can only run it checkUpkeep is true", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					]);
					await network.provider.send("evm_mine", []);
					const tx = raffle.performUpkeep([]);
					assert(tx);
				});
				it("reverts when checkUpkeep is false", async () => {
					await expect(
						raffle.performUpkeep([])
					).to.be.revertedWithCustomError(
						raffle,
						"Raffle_UpkeepNotNeeded"
					);
				});
				it("updates the raffle state, emits an event and calls the vrg coordinator", async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					]);
					await network.provider.send("evm_mine", []);
					const txResponse = await raffle.performUpkeep([]);
					const txReceipt = await txResponse.wait(1);
					const requestId = txReceipt.events[1].args.requestId;
					const raffleState = await raffle.getRaffleState();
					assert(requestId.toNumber() > 0);
					assert(raffleState == 1);
				});
			});
			describe("fulfillRandomWords", () => {
				beforeEach(async () => {
					await raffle.enterRaffle({ value: raffleEntranceFee });
					await network.provider.send("evm_increaseTime", [
						interval.toNumber() + 1,
					]);
					await network.provider.send("evm_mine", []);
				});

				it("can only be called after performUpkeep", async () => {
					await expect(
						vrfCoordinatorV2Mock.fulfillRandomWords(
							0,
							raffle.address
						)
					).to.be.revertedWith("nonexistent request");
				});
				it("picks a winner, resets the lottery and sends money", async () => {
					const additionalEntrants = 3;
					const startingAccountIndex = 1; // deployer is 0
					const accounts = await ethers.getSigners();
					for (
						let i = startingAccountIndex;
						i < startingAccountIndex + additionalEntrants;
						i++
					) {
						const accountConnectedRaffle = await raffle.connect(
							accounts[i]
						);
						await accountConnectedRaffle.enterRaffle({
							value: raffleEntranceFee,
						});
					}

					const startingTimeStamp = await raffle.getLatestTimeStamp();

					await new Promise(async (resolve, reject) => {
						raffle.once("WinnerPicked", async () => {
							console.log("found the event!");
							try {
								const recentWinner =
									await raffle.getRecentWinner(); // accounts[1] in this case
								const raffleState =
									await raffle.getRaffleState();
								const endingTimeStamp =
									await raffle.getLatestTimeStamp();
								const numPlayers =
									await raffle.getNumberOfPlayers();
								const winnerEndingBalance =
									await accounts[1].getBalance();
								assert.equal(numPlayers.toString(), "0");
								assert.equal(raffleState.toString(), 0);
								assert(endingTimeStamp > startingTimeStamp);

								assert.equal(
									winnerEndingBalance.toString(),
									winnerStartingBalance.add(
										raffleEntranceFee
											.mul(additionalEntrants)
											.add(raffleEntranceFee)
											.toString()
									)
								);
							} catch (e) {
								reject(e);
							}
							resolve();
						});
						const tx = await raffle.performUpkeep([]);
						const txReceipt = await tx.wait(1);
						const winnerStartingBalance =
							await accounts[1].getBalance();

						await vrfCoordinatorV2Mock.fulfillRandomWords(
							txReceipt.events[1].args.requestId,
							raffle.address
						);
					});
				});
			});
	  });
