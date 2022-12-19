const { run } = require("hardhat");

exports.verify = async (contractAddress, args) => {
	console.log("Verifying...");
	try {
		await run("verify:verify", {
			address: contractAddress,
			constructorArguments: args,
		});
	} catch (e) {
		if (e.message.toLowerCase().includes("already verified")) {
			console.log("Already Verified");
		} else {
			console.log(e);
		}
	}
};
