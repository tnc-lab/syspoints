# Syspoints ⠎⠽⠎⠏⠕⠊⠝⠞⠎

![Syspoints](https://i.ibb.co/fY7fhskW/syspoints-banner.png)

| 🇺🇸 English | [🇪🇸 Español](docs/README.es.md) | [🇧🇷 Português](docs/README.pt.md)

**Syspoints** is a blockchain-based review and reputation platform built on **Syscoin**. It incentivizes users with **Syspoints Tokens** for contributing trusted, immutable reviews through a unique **Review-to-Earn** model.

## Key Functions

- **Decentralized Reviews:** Submit immutable feedback for stores and establishments directly on the Syscoin NEVM, ensuring data integrity through Ethereum-compatible smart contracts.
- **Incentivized Participation:** Earn **Syspoints Tokens** as a reward for verified and high-quality reviews.
- **Transparent Reputation:** Leverage blockchain transparency to ensure all ratings are authentic and tamper-proof.

## Project Documentation

- **[Architecture](docs/architecture.md):** Overview of the system infrastructure and component organization using **C4 Container diagrams**.
- **[Business Rules](docs/business_rules.md):** Detailed mapping of logical workflows and the core rules governing the application via **flowcharts**.
- **[Data Model](docs/data_model.md):** Database schema documentation featuring **Entity-Relationship (ER) diagrams**.
- **[Syscoin Integration](docs/syscoin_integration.md):** Technical guide on blockchain communication protocols and transaction **sequence diagrams**.

## Usage

The following is a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
# Displays a Hardhat manual
npx hardhat help

# Run tests to ensure review logic works
npx hardhat test

# Generate a detailed report on gas consumption
REPORT_GAS=true npx hardhat test

# Start a local node for development
npx hardhat node

# Deploy the Syspoints contract
npx hardhat ignition deploy ./ignition/modules/Lock.js
```

## Useful Links

- **Network Documentation:** [Syscoin Docs](https://docs.syscoin.org)
- **Block Explorer:** [Syscoin Explorer](https://explorer.syscoin.org)

## License

This project is licensed under the [MIT License](https://opensource.org) - see the [LICENSE](LICENSE) file for details.