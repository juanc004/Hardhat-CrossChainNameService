import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import {
  CCIPLocalSimulator,
  CrossChainNameServiceRegister,
  CrossChainNameServiceReceiver,
  CrossChainNameServiceLookup,
} from "../typechain-types";

// Test suite for the CCIP Cross Chain Name Service
describe("CCIP Cross Chain Name Service Test", function () {
  // Create variables for contract factories and instances
  let ccipLocalSimualtorFactory: any, ccipLocalSimulator: CCIPLocalSimulator;
  let ccnsRegisterFactory: any, ccnsRegister: CrossChainNameServiceRegister;
  let ccnsReceiverFactory: any, ccnsReceiver: CrossChainNameServiceReceiver;
  let ccnsLookupFactory: any,
    sourceCcnsLookup: CrossChainNameServiceLookup,
    destinationCcnsLookup: CrossChainNameServiceLookup;
  let alice: Signer;

  // Before all tests, set up the environment by deploying contracts and configuring them
  before(async function () {
    // Retrieve the list of available signers and select Alice as the test user
    [, alice] = await ethers.getSigners();

    console.log("\n===============================================");
    console.log("Step 1: Deploying CCIPLocalSimulator Contract");
    console.log("===============================================\n");

    // 1. Create an instance of CCIPLocalSimulator.sol smart contract
    ccipLocalSimualtorFactory = await ethers.getContractFactory(
      "CCIPLocalSimulator"
    );
    ccipLocalSimulator = await ccipLocalSimualtorFactory.deploy();
    await ccipLocalSimulator.deployed();  // Wait for the contract to be deployed
    console.log(
      `✔️ CCIP Local Simulator deployed at address: ${ccipLocalSimulator.address}`
    );

    console.log("\n========================================================");
    console.log("Step 2: Fetching Configuration from CCIPLocalSimulator");
    console.log("========================================================\n");

    // 2. Call the configuration() function to get Router contract address
    const config = await ccipLocalSimulator.configuration();
    const sourceRouterAddress = config.sourceRouter_;
    const destinationRouterAddress = config.destinationRouter_;
    const chainSelector = config.chainSelector_;
    console.log(
      `✔️ Configuration obtained:\n   Source Router: ${sourceRouterAddress}\n   Destination Router: ${destinationRouterAddress}\n   Chain Selector: ${chainSelector}`
    );

    console.log("\n=========================================================");
    console.log("Step 3: Deploying and Configuring Cross-Chain Contracts");
    console.log("=========================================================\n");

    // 3. Deploy and configure the necessary cross-chain contracts for both the source and destination chains and call the enableChain() function

    // Deploy CrossChainNameServiceLookup contract for the source chain
    ccnsLookupFactory = await ethers.getContractFactory(
      "CrossChainNameServiceLookup"
    );
    sourceCcnsLookup = await ccnsLookupFactory.deploy();
    await sourceCcnsLookup.deployed();
    console.log(
      `✔️ Source CrossChainNameServiceLookup deployed at address: ${sourceCcnsLookup.address}`
    );

    // Deploy the CrossChainNameServiceRegister contract to manage registrations
    ccnsRegisterFactory = await ethers.getContractFactory(
      "CrossChainNameServiceRegister"
    );
    ccnsRegister = await ccnsRegisterFactory.deploy(
      sourceRouterAddress,
      sourceCcnsLookup.address
    );
    await ccnsRegister.deployed();
    console.log(
      `✔️ CrossChainNameServiceRegister deployed at address: ${ccnsRegister.address}`
    );

    // Deploy the CrossChainNameServiceLookup contract for the destination chain
    destinationCcnsLookup = await ccnsLookupFactory.deploy();
    await destinationCcnsLookup.deployed();
    console.log(
      `✔️ Destination CrossChainNameServiceLookup deployed at address: ${destinationCcnsLookup.address}`
    );

    // Deploy the CrossChainNameServiceReceiver contract to handle cross-chain data reception
    ccnsReceiverFactory = await ethers.getContractFactory(
      "CrossChainNameServiceReceiver"
    );
    ccnsReceiver = await ccnsReceiverFactory.deploy(
      destinationRouterAddress,
      destinationCcnsLookup.address,
      chainSelector
    );
    await ccnsReceiver.deployed();
    console.log(
      `✔️ CrossChainNameServiceReceiver deployed at address: ${ccnsReceiver.address}`
    );

    // Enable the destination chain in the CrossChainNameServiceRegister contract to allow cross-chain operations
    let txResponse = await ccnsRegister.enableChain(
      chainSelector,
      ccnsReceiver.address,
      500_000n
    );
    await txResponse.wait(); // Wait for the transaction to be confirmed
    console.log(
      `✔️ Enabled destination chain on CrossChainNameServiceRegister.\n   Transaction Hash: ${txResponse.hash}`
    );

    console.log("\n===============================================");
    console.log("Step 4: Setting Cross-Chain Service Addresses");
    console.log("===============================================\n");

    // 4. Set up the cross-chain service addresses for both the source and destination chain lookups

    // Configure the source chain's lookup contract with the address of the registration contract
    txResponse = await sourceCcnsLookup.setCrossChainNameServiceAddress(
      ccnsRegister.address
    );
    await txResponse.wait();
    console.log(
      `✔️ Set register address on source CrossChainNameServiceLookup.\n   Transaction Hash: ${txResponse.hash}`
    );

    // Configure the destination chain's lookup contract with the address of the receiver contract
    txResponse = await destinationCcnsLookup.setCrossChainNameServiceAddress(
      ccnsReceiver.address
    );
    await txResponse.wait();
    console.log(
      `✔️ Set receiver address on destination CrossChainNameServiceLookup.\n   Transaction Hash: ${txResponse.hash}`
    );

    console.log(
      "\n✔️ Step 4: Completed setting CrossChainNameServiceRegister and CrossChainNameServiceReceiver addresses on the respective CrossChainNameServiceLookup instances.\n"
    );
  });

  // Test case: Register a name on the cross-chain name service and verify it resolves correctly on both chains
  it("Step 5 & 6: Register and Lookup Name on Cross-Chain Name Service", async function () {
    console.log("\n=======================================");
    console.log("Step 5: Registering Name 'alice.ccns'");
    console.log("=======================================\n");

    // 5. Register the name 'alice.ccns' using Alice's account
    const txResponse = await ccnsRegister.connect(alice).register("alice.ccns");
    await txResponse.wait();
    console.log(
      `✔️ Registered 'alice.ccns' for Alice's address.\n   Transaction Hash: ${txResponse.hash}`
    );

    console.log("\n================================================");
    console.log("Step 6: Looking Up 'alice.ccns' on Both Chains");
    console.log("================================================\n");

    // 6. Lookup the name 'alice.ccns' on the source chain and verify it resolves to Alice's address
    const resolvedAddressSource = await sourceCcnsLookup.lookup("alice.ccns");
    if (resolvedAddressSource === (await alice.getAddress())) {
      console.log(
        `✔️ Successfully resolved 'alice.ccns' on source chain to Alice's address: ${resolvedAddressSource}`
      );
    } else {
      console.log(
        `❌ Failed to resolve 'alice.ccns' on source chain. Expected: ${await alice.getAddress()}, but got: ${resolvedAddressSource}`
      );
    }
    expect(resolvedAddressSource).to.equal(await alice.getAddress());

    // Lookup the name 'alice.ccns' on the destination chain and verify it resolves to Alice's address
    const resolvedAddressDestination = await destinationCcnsLookup.lookup(
      "alice.ccns"
    );
    if (resolvedAddressDestination === (await alice.getAddress())) {
      console.log(
        `✔️ Successfully resolved 'alice.ccns' on destination chain to Alice's address: ${resolvedAddressDestination}`
      );
    } else {
      console.log(
        `❌ Failed to resolve 'alice.ccns' on destination chain. Expected: ${await alice.getAddress()}, but got: ${resolvedAddressDestination}`
      );
    }
    expect(resolvedAddressDestination).to.equal(await alice.getAddress());

    console.log(
      "\n✔️ Step 6: Completed lookup for 'alice.ccns' and verified that it resolves to Alice’s EOA address on both chains.\n"
    );
  });
});
