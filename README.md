## Day 2 Homework Solution: CCIP Cross-Chain Name Service

This repository contains the solution to the Day 2 Homework for the Chainlink CCIP Cross-Chain Name Service project. The goal was to write a test that simulates cross-chain interactions using Chainlink Local's Local Mode with Hardhat.

## Running the test

### 1. Clone this repo

```bash
gh repo clone https://github.com/juanc004/Hardhat-CrossChainNameService.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the test

```bash
npx hardhat test --network hardhat
```

## Solution Summary

### 1. Deploy CCIPLocalSimulator
   Task: Set up a simulated CCIP environment.

```typescript
// Deploy the CCIPLocalSimulator contract
const ccipLocalSimualtorFactory = await ethers.getContractFactory(
  "CCIPLocalSimulator"
);
const ccipLocalSimulator = await ccipLocalSimualtorFactory.deploy();
await ccipLocalSimulator.deployed();
```

### 2. Retrieve Router Configuration
   Task: Get router addresses and chain selector.

```typescript
// Call configuration() to get router addresses and chain selector
const config = await ccipLocalSimulator.configuration();
const sourceRouterAddress = config.sourceRouter_;
const destinationRouterAddress = config.destinationRouter_;
const chainSelector = config.chainSelector_;
```

### 3. Deploy and Configure Cross-Chain Contracts
   Task: Set up the cross-chain name service system.

```typescript
// Deploy CrossChainNameServiceLookup for the source chain
const ccnsLookupFactory = await ethers.getContractFactory(
  "CrossChainNameServiceLookup"
);
const sourceCcnsLookup = await ccnsLookupFactory.deploy();
await sourceCcnsLookup.deployed();

// Deploy CrossChainNameServiceRegister contract
const ccnsRegisterFactory = await ethers.getContractFactory(
  "CrossChainNameServiceRegister"
);
const ccnsRegister = await ccnsRegisterFactory.deploy(
  sourceRouterAddress,
  sourceCcnsLookup.address
);
await ccnsRegister.deployed();

// Deploy CrossChainNameServiceLookup for the destination chain
const destinationCcnsLookup = await ccnsLookupFactory.deploy();
await destinationCcnsLookup.deployed();

// Deploy CrossChainNameServiceReceiver for the destination chain
const ccnsReceiverFactory = await ethers.getContractFactory(
  "CrossChainNameServiceReceiver"
);
const ccnsReceiver = await ccnsReceiverFactory.deploy(
  destinationRouterAddress,
  destinationCcnsLookup.address,
  chainSelector
);
await ccnsReceiver.deployed();

// Enable the destination chain on CrossChainNameServiceRegister
await ccnsRegister.enableChain(chainSelector, ccnsReceiver.address, 500_000n);
```

### 4. Set Cross-Chain Service Addresses
   Task: Link the name service contracts.

```typescript
// Set the register address on the source CrossChainNameServiceLookup
await sourceCcnsLookup.setCrossChainNameServiceAddress(ccnsRegister.address);

// Set the receiver address on the destination CrossChainNameServiceLookup
await destinationCcnsLookup.setCrossChainNameServiceAddress(
  ccnsReceiver.address
);
```

### 5. Register a Domain Name
   Task: Register "alice.ccns" using Alice's address.

```typescript
// Register "alice.ccns" with Alice's EOA
const alice = ethers.getSigners()[1];
const txResponse = await ccnsRegister.connect(alice).register("alice.ccns");
await txResponse.wait();
```

### 6. Lookup the Registered Name
   Task: Verify that "alice.ccns" resolves correctly.

```typescript
// Lookup "alice.ccns" on the source chain
const resolvedAddressSource = await sourceCcnsLookup.lookup("alice.ccns");
expect(resolvedAddressSource).to.equal(await alice.getAddress());

// Lookup "alice.ccns" on the destination chain
const resolvedAddressDestination = await destinationCcnsLookup.lookup(
  "alice.ccns"
);
expect(resolvedAddressDestination).to.equal(await alice.getAddress());
```
