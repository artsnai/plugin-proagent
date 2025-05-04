# ProAgent Plugin

This ElizaOS plugin provides integration with the Aerodrome protocol on the Base network, allowing for liquidity provision, token management, and DeFi interactions directly through ProAgent Smart contracts.

## Features

The plugin offers the following capabilities:

- Get your Aerodrome manager address
- Check token balances in your manager contract
- View staked LP positions and rewards
- Deposit tokens into your manager
- Add liquidity to Aerodrome pools
- Liquidate positions (unstake and remove liquidity)
- Withdraw tokens from your manager
- Claim rewards from staked positions
- Claim trading fees from pools
- View claimable trading fees in pools

## Configuration

This plugin requires the following environment variables:

```json
"agentConfig": {
  "pluginType": "elizaos:plugin:1.0.0",
  "pluginParameters": {
    "EVM_PRIVATE_KEY": {
      "type": "string",
      "description": "Private key for EVM transactions on Base network"
    },
    "EVM_PROVIDER_URL": {
      "type": "string",
      "description": "RPC provider URL for Base network"
    }
  }
}
```

## Available Actions

### GET_MANAGER_ADDRESS
Returns the address of your Aerodrome manager contract.

Example: "What is my manager address?"

### BALANCES
Returns the token balances in your manager contract.

Example: "Show me my token balances"

### STAKED_POSITIONS
Returns your staked LP positions and rewards.

Example: "What are my staked positions?"

### DEPOSIT_TOKENS
Deposits tokens into your manager contract.

Example: "Deposit 10 USDC to my manager"

### ADD_LIQUIDITY
Adds liquidity to an Aerodrome pool and automatically stakes the LP tokens for rewards.

Example: "Add liquidity to the USDC-AERO pool"

### LIQUIDATE_POSITION
Unstakes LP tokens and removes liquidity from a specified pool, returning the underlying tokens to your manager.

Example: "Liquidate my USDC-WETH position"

### WITHDRAW_TOKENS
Withdraws tokens from your manager contract to your wallet.

Example: "Withdraw all my USDC" or "Withdraw 5 WETH"

### CLAIM_REWARDS
Claims rewards from your staked positions in Aerodrome pools.

Example: "Claim rewards from USDC-WETH pool" or "Claim all my rewards"

### CLAIM_FEES
Claims trading fees from your liquidity positions in Aerodrome pools.

Example: "Claim fees from USDC-WETH pool"

### SHOW_CLAIMABLE_FEES
Displays the trading fees that are available to claim from your pools.

Example: "Show claimable fees for all my pools" or "Check available fees for USDC-WETH pool"

## Development

```bash
# Start development with hot-reloading
npm run dev

# Build the plugin
npm run build

# Test the plugin
npm run test
```

## Publishing

Before publishing your plugin to the ElizaOS registry, ensure you meet these requirements:

1. **GitHub Repository**
   - Create a public GitHub repository for this plugin
   - Add the 'elizaos-plugins' topic to the repository
   - Use 'main' as the default branch

2. **Required Assets**
   - Add images to the `images/` directory:
     - `logo.jpg` (400x400px square, <500KB)
     - `banner.jpg` (1280x640px, <1MB)

3. **Publishing Process**
   ```bash
   # Check if your plugin meets all registry requirements
   npx elizaos plugin publish --test
   
   # Publish to the registry
   npx elizaos plugin publish
   ```

After publishing, your plugin will be submitted as a pull request to the ElizaOS registry for review.

## Documentation

### About ProAgent

ProAgent is a platform for creating and managing Liquidity Pools using smart contracts. Unlocking automations Such as:

- Adding liquidity to pools + Auto-staking LP tokens
- Staking LP tokens
- Claiming rewards
- Exiting positions
- Compound rewards
- Viewing your positions
- Managing your positions
- Automating your positions

### About Aerodrome

Aerodrome is a decentralized exchange (DEX) on the Base network, forked from Velodrome. It features:

- Liquidity pools with variable fees
- Staking rewards through gauge contracts
- Vote-escrowed tokenomics with veAERO

### Using This Plugin

1. **Setup Manager**:
   - The first time you use the plugin, you'll need to create a manager contract.
   - Ask: "Create a new manager for me"

2. **Fund Your Manager**:
   - Before adding liquidity, deposit tokens to your manager.
   - Ask: "Deposit 10 USDC to my manager"

3. **Add Liquidity & Stake**:
   - Once you have tokens in your manager, add liquidity to pools.
   - The LP tokens are automatically staked to earn rewards.
   - Ask: "Add liquidity to the USDC-WETH pool"

4. **Monitor Your Positions**:
   - Check your balances and staked positions regularly.
   - Ask: "Show me my staked positions"

5. **Check Claimable Fees**:
   - View the trading fees that have accumulated in your pools.
   - Ask: "Show claimable fees for all my pools" or "Check fees for USDC-AERO pool"

6. **Claim Rewards**:
   - Harvest rewards from your staked positions when they accumulate.
   - Ask: "Claim rewards from USDC-AERO pool" or "Claim all my rewards"

7. **Claim Trading Fees**:
   - Collect trading fees that have accumulated in your pools.
   - Ask: "Claim fees from USDC-AERO pool"

8. **Liquidate Positions**:
   - When you want to exit a position, you can liquidate it to unstake and remove liquidity in one step.
   - Ask: "Liquidate my USDC-AERO position"

9. **Withdraw Tokens**:
   - After removing liquidity or when you need your tokens, withdraw them to your wallet.
   - Ask: "Withdraw all my USDC" or "Withdraw 5 WETH"

### Important Note on Contract Implementation

This plugin requires the manager contract to implement certain functions:
- `addLiquidityAerodrome` - To add liquidity to pools
- `approveToken` - To approve token spending
- `stakeLPTokens` - To stake LP tokens in gauges
- `unstakeLPTokens` - To unstake LP tokens from gauges
- `removeLiquidity` - To remove liquidity from pools
- `withdrawTokens` - To withdraw tokens from the manager
- `claimRewards` - To claim rewards from a specific pool
- `claimAllRewards` - To claim rewards from all pools
- `claimFees` - To claim trading fees from pools
- `getClaimableFees` - To check available trading fees in pools

If your contract implementation is missing any of these methods, some actions may fail. Make sure to use the latest UserLPManager contract that includes all required functionality.

### Technical Details

The plugin uses ethers.js to interact with Ethereum-compatible smart contracts on the Base network. All transactions are signed using the provided private key and sent through the specified RPC provider URL.

For more information about Aerodrome, visit [aerodrome.finance](https://aerodrome.finance).
