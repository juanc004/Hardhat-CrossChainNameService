import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { CCIPLocalSimulator, CrossChainNameServiceRegister, CrossChainNameServiceReceiver, CrossChainNameServiceLookup } from "../typechain-types";

describe("CCIP Cross Chain Name Service Test", function () {
  let ccipLocalSimualtorFactory: any, ccipLocalSimulator: CCIPLocalSimulator;
  let ccnsRegisterFactory: any, ccnsRegister: CrossChainNameServiceRegister;
  let ccnsReceiverFactory: any, ccnsReceiver: CrossChainNameServiceReceiver;
  let ccnsLookupFactory: any, sourceCcnsLookup: CrossChainNameServiceLookup, destinationCcnsLookup: CrossChainNameServiceLookup;
  let alice: Signer;

  before(async function () {
    // Get signers; we assume Alice is the second signer in the list
    [, alice] = await ethers.getSigners();

    console.log("\n===============================");
    console.log("Step 1: Deploying CCIPLocalSimulator Contract");
    console.log("===============================\n");

    // 1. Create an instance of CCIPLocalSimulator.sol smart contract
    ccipLocalSimualtorFactory = await ethers.getContractFactory("CCIPLocalSimulator");
    ccipLocalSimulator = await ccipLocalSimualtorFactory.deploy();
    await ccipLocalSimulator.deployed();
    console.log(`✔️ CCIP Local Simulator deployed at address: ${ccipLocalSimulator.address}`);
    
    console.log("\n===============================");
    console.log("Step 2: Fetching Configuration from CCIPLocalSimulator");
    console.log("===============================\n");

    // 2. Call the configuration() function to get Router contract address
    const config = await ccipLocalSimulator.configuration();
    const sourceRouterAddress = config.sourceRouter_;
    const destinationRouterAddress = config.destinationRouter_;
    const chainSelector = config.chainSelector_;
    console.log(`✔️ Configuration obtained:\n   Source Router: ${sourceRouterAddress}\n   Destination Router: ${destinationRouterAddress}\n   Chain Selector: ${chainSelector}`);
    
    console.log("\n===============================");
    console.log("Step 3: Deploying and Configuring Cross-Chain Contracts");
    console.log("===============================\n");

    // 3. Create instances of CrossChainNameServiceRegister.sol, CrossChainNameServiceReceiver.sol and CrossChainNameServiceLookup.sol smart contracts and call the enableChain() function where needed
    // Deploy CrossChainNameServiceLookup contract for the source chain
    ccnsLookupFactory = await ethers.getContractFactory("CrossChainNameServiceLookup");
    sourceCcnsLookup = await ccnsLookupFactory.deploy();
    await sourceCcnsLookup.deployed();
    console.log(`✔️ Source CrossChainNameServiceLookup deployed at address: ${sourceCcnsLookup.address}`);

    // Deploy CrossChainNameServiceRegister contract
    ccnsRegisterFactory = await ethers.getContractFactory("CrossChainNameServiceRegister");
    ccnsRegister = await ccnsRegisterFactory.deploy(sourceRouterAddress, sourceCcnsLookup.address);
    await ccnsRegister.deployed();
    console.log(`✔️ CrossChainNameServiceRegister deployed at address: ${ccnsRegister.address}`);

    // Deploy CrossChainNameServiceLookup contract for the destination chain
    destinationCcnsLookup = await ccnsLookupFactory.deploy();
    await destinationCcnsLookup.deployed();
    console.log(`✔️ Destination CrossChainNameServiceLookup deployed at address: ${destinationCcnsLookup.address}`);

    // Deploy CrossChainNameServiceReceiver contract for the destination chain
    ccnsReceiverFactory = await ethers.getContractFactory("CrossChainNameServiceReceiver");
    ccnsReceiver = await ccnsReceiverFactory.deploy(destinationRouterAddress, destinationCcnsLookup.address, chainSelector);
    await ccnsReceiver.deployed();
    console.log(`✔️ CrossChainNameServiceReceiver deployed at address: ${ccnsReceiver.address}`);

    // Enable the destination chain on CrossChainNameServiceRegister contract
    let txResponse = await ccnsRegister.enableChain(chainSelector, ccnsReceiver.address, 500_000n);
    await txResponse.wait();
    console.log(`✔️ Enabled destination chain on CrossChainNameServiceRegister.\n   Transaction Hash: ${txResponse.hash}`);
    
    console.log("\n===============================");
    console.log("Step 4: Setting Cross-Chain Service Addresses");
    console.log("===============================\n");

    // 4. Call the setCrossChainNameServiceAddress function of the CrossChainNameServiceLookup.sol smart contract "source" instance and provide the address of the CrossChainNameServiceRegister.sol smart contract instance
    txResponse = await sourceCcnsLookup.setCrossChainNameServiceAddress(ccnsRegister.address);
    await txResponse.wait();
    console.log(`✔️ Set register address on source CrossChainNameServiceLookup.\n   Transaction Hash: ${txResponse.hash}`);

    // Repeat the process for the CrossChainNameServiceLookup.sol smart contract "receiver" instance and provide the address of the CrossChainNameServiceReceiver.sol smart contract instance
    txResponse = await destinationCcnsLookup.setCrossChainNameServiceAddress(ccnsReceiver.address);
    await txResponse.wait();
    console.log(`✔️ Set receiver address on destination CrossChainNameServiceLookup.\n   Transaction Hash: ${txResponse.hash}`);
    
    console.log("\n✔️ Step 4: Completed setting CrossChainNameServiceRegister and CrossChainNameServiceReceiver addresses on the respective CrossChainNameServiceLookup instances.\n");
  });

  it("Step 5 & 6: Register and Lookup Name on Cross-Chain Name Service", async function () {
    console.log("\n===============================");
    console.log("Step 5: Registering Name 'alice.ccns'");
    console.log("===============================\n");

    // 5. Call the register() function and provide “alice.ccns” and Alice’s EOA address as function arguments
    const txResponse = await ccnsRegister.connect(alice).register("alice.ccns");
    await txResponse.wait();
    console.log(`✔️ Registered 'alice.ccns' for Alice's address.\n   Transaction Hash: ${txResponse.hash}`);

    console.log("\n===============================");
    console.log("Step 6: Looking Up 'alice.ccns' on Both Chains");
    console.log("===============================\n");

    // 6. Call the lookup() function and provide “alice.ccns” as a function argument. Assert that the returned address is Alice’s EOA address.
    const resolvedAddressSource = await sourceCcnsLookup.lookup("alice.ccns");
    if (resolvedAddressSource === await alice.getAddress()) {
      console.log(`✔️ Successfully resolved 'alice.ccns' on source chain to Alice's address: ${resolvedAddressSource}`);
    } else {
      console.log(`❌ Failed to resolve 'alice.ccns' on source chain. Expected: ${await alice.getAddress()}, but got: ${resolvedAddressSource}`);
    }
    expect(resolvedAddressSource).to.equal(await alice.getAddress());

    const resolvedAddressDestination = await destinationCcnsLookup.lookup("alice.ccns");
    if (resolvedAddressDestination === await alice.getAddress()) {
      console.log(`✔️ Successfully resolved 'alice.ccns' on destination chain to Alice's address: ${resolvedAddressDestination}`);
    } else {
      console.log(`❌ Failed to resolve 'alice.ccns' on destination chain. Expected: ${await alice.getAddress()}, but got: ${resolvedAddressDestination}`);
    }
    expect(resolvedAddressDestination).to.equal(await alice.getAddress());

    console.log("\n✔️ Step 6: Completed lookup for 'alice.ccns' and verified that it resolves to Alice’s EOA address on both chains.\n");
  });
});
