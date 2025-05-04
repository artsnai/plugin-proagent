import { ethers } from 'ethers';
import AerodromeManager from './aerodrome';
import { ADDRESSES } from './addresses';

// Define interface for the combined result type
export interface AddLiquidityAndStakeResult {
  success: boolean;
  message?: string;
  txHash?: string;
  poolName?: string;
  tokenA?: any;
  tokenB?: any;
  lpTokenInfo?: any;
  staked: boolean;
  stakeResult?: {
    success: boolean;
    message?: string;
    txHash?: string;
  };
  error?: any;
}

// Initialize provider and signer from environment variables
const initializeProvider = () => {
  try {
    // Use environment variables for provider URL and private key
    const providerUrl = process.env.EVM_PROVIDER_URL;
    const privateKey = process.env.EVM_PRIVATE_KEY;

    if (!providerUrl) {
      throw new Error('EVM_PROVIDER_URL environment variable not set');
    }

    if (!privateKey) {
      throw new Error('EVM_PRIVATE_KEY environment variable not set');
    }

    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    return { provider, wallet };
  } catch (error) {
    console.error('Error initializing provider:', error);
    throw error;
  }
};

// Get instance of AerodromeManager
export const getAerodromeManager = async () => {
  try {
    const { wallet } = initializeProvider();
    const chainId = 8453; // Base network
    // Cast wallet to any to avoid TypeScript error
    const manager = new AerodromeManager(wallet as any, chainId);
    
    return manager;
  } catch (error) {
    console.error('Error creating AerodromeManager:', error);
    throw error;
  }
};

// Initialize the manager and get the address
export const getManagerAddress = async (): Promise<string | null> => {
  try {
    const manager = await getAerodromeManager();
    const result = await manager.initialize();
    
    if (result.success) {
      return result.managerAddress || null;
    } else {
      console.error('Error initializing manager:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error getting manager address:', error);
    return null;
  }
};

// Get token balances from manager
export const getTokenBalances = async () => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    const result = await manager.getManagerBalances();
    
    if (result.success) {
      return result.balances;
    } else {
      console.error('Error getting token balances:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error getting token balances:', error);
    return null;
  }
};

// Get staked positions
export const getStakedPositions = async () => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    const result = await manager.getStakedPositions();
    
    if (result.success) {
      return {
        positions: result.positions || [],
        stakedPositions: result.stakedPositions || [],
        gauges: result.gauges || [],
        totalRewards: result.totalRewards || BigInt(0),
        formattedTotalRewards: result.formattedTotalRewards || '0'
      };
    } else {
      console.error('Error getting staked positions:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error getting staked positions:', error);
    return null;
  }
};

// Check if an address is a manager
export const isManager = async (managerAddress: string): Promise<boolean> => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    const result = await manager.isManager(managerAddress);
    
    return result.success && result.isManager;
  } catch (error) {
    console.error('Error checking if address is manager:', error);
    return false;
  }
};

// Add a manager
export const addManager = async (managerAddress: string) => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    return await manager.addManager(managerAddress);
  } catch (error) {
    console.error('Error adding manager:', error);
    throw error;
  }
};

// Remove a manager
export const removeManager = async (managerAddress: string) => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    return await manager.removeManager(managerAddress);
  } catch (error) {
    console.error('Error removing manager:', error);
    throw error;
  }
};

// Claim fees
export const claimFees = async (tokenA: string, tokenB: string, stable: boolean) => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    return await manager.claimFees(tokenA, tokenB, stable);
  } catch (error) {
    console.error('Error claiming fees:', error);
    throw error;
  }
};

// Add liquidity to a pool - simplified version
export const addLiquidity = async (poolName: string) => {
  try {
    // Initialize the manager
    const manager = await getAerodromeManager();
    const result = await manager.initialize();
    
    if (!result.success || !result.managerAddress) {
      return { 
        success: false, 
        message: "Failed to initialize manager" 
      };
    }
    
    // Get manager address for logs
    const managerAddress = result.managerAddress;
    console.log(`Using manager at ${managerAddress}`);
    
    // Find pool tokens
    const tokenSymbols = poolName.split('-');
    if (tokenSymbols.length !== 2) {
      return { 
        success: false, 
        message: `Invalid pool name format: ${poolName}` 
      };
    }
    
    // Get token addresses
    const token0 = ADDRESSES.BASE[tokenSymbols[0]];
    const token1 = ADDRESSES.BASE[tokenSymbols[1]];
    
    if (!token0 || !token1) {
      return { 
        success: false, 
        message: `Could not find addresses for tokens: ${tokenSymbols[0]}, ${tokenSymbols[1]}` 
      };
    }
    
    // Determine if stable pool
    const stable = poolName.toLowerCase().includes('stable');
    
    // Get token balances
    let balance0: bigint, balance1: bigint;
    try {
      // Use public methods to get token balances
      const balancesResult = await manager.getManagerBalances();
      
      if (!balancesResult.success || !balancesResult.balances) {
        return {
          success: false,
          message: "Failed to get token balances"
        };
      }
      
      // Get balances from result
      // Check both possible properties where the balance might be stored
      const token0Balance = balancesResult.balances[tokenSymbols[0]];
      const token1Balance = balancesResult.balances[tokenSymbols[1]];
      
      console.log(`Raw balance objects:
        ${tokenSymbols[0]}: `, token0Balance,
        `${tokenSymbols[1]}: `, token1Balance
      );
      
      if (!token0Balance || !token1Balance) {
        return {
          success: false,
          message: `Could not find balances for tokens: ${tokenSymbols[0]}, ${tokenSymbols[1]}`
        };
      }
      
      // Get the actual balance value - try different properties
      let balance0Formatted = token0Balance.value || token0Balance.balance;
      let balance1Formatted = token1Balance.value || token1Balance.balance;
      
      // If still not found, search for any property that might be a balance
      if (!balance0Formatted && typeof token0Balance === 'object') {
        console.log(`Trying to find balance property in ${tokenSymbols[0]}:`, Object.keys(token0Balance));
        // Look for any property that could be a balance (bigint, number, string with numbers)
        for (const key of Object.keys(token0Balance)) {
          const val = token0Balance[key];
          if (typeof val === 'bigint' || 
              (typeof val === 'string' && /^\d+$/.test(val)) ||
              (typeof val === 'number' && !isNaN(val))) {
            console.log(`Found potential balance in property ${key}:`, val);
            balance0Formatted = val;
            break;
          }
        }
      }
      
      if (!balance1Formatted && typeof token1Balance === 'object') {
        console.log(`Trying to find balance property in ${tokenSymbols[1]}:`, Object.keys(token1Balance));
        // Look for any property that could be a balance
        for (const key of Object.keys(token1Balance)) {
          const val = token1Balance[key];
          if (typeof val === 'bigint' || 
              (typeof val === 'string' && /^\d+$/.test(val)) ||
              (typeof val === 'number' && !isNaN(val))) {
            console.log(`Found potential balance in property ${key}:`, val);
            balance1Formatted = val;
            break;
          }
        }
      }
      
      if (!balance0Formatted || !balance1Formatted) {
        console.error(`Balance property not found in token objects:
          ${tokenSymbols[0]}: `, token0Balance,
          `${tokenSymbols[1]}: `, token1Balance
        );
        return {
          success: false,
          message: `Balance property not found in token objects: ${tokenSymbols[0]}, ${tokenSymbols[1]}`
        };
      }
      
      console.log(`Found balances:
        ${tokenSymbols[0]}: ${balance0Formatted}
        ${tokenSymbols[1]}: ${balance1Formatted}
      `);
      
      try {
        balance0 = BigInt(balance0Formatted.toString());
        balance1 = BigInt(balance1Formatted.toString());
      } catch (error) {
        console.error(`Error converting balances to BigInt:
          ${tokenSymbols[0]}: ${balance0Formatted}
          ${tokenSymbols[1]}: ${balance1Formatted}
          Error: ${(error as Error).message}
        `);
        return {
          success: false,
          message: `Error converting balances to BigInt: ${(error as Error).message}`
        };
      }
      
      console.log(`Current balances:
        ${tokenSymbols[0]}: ${ethers.formatUnits(balance0, tokenSymbols[0] === 'USDC' ? 6 : 18)}
        ${tokenSymbols[1]}: ${ethers.formatUnits(balance1, tokenSymbols[1] === 'USDC' ? 6 : 18)}
      `);
      
      if (balance0 === 0n || balance1 === 0n) {
        return {
          success: false,
          message: `Insufficient balance for one or both tokens. Please deposit tokens first.`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to get token balances: ${(error as Error).message}`
      };
    }
    
    // Calculate minimum amounts (30% slippage)
    const slippage = 30;
    const minAmount0 = (balance0 * BigInt(Math.floor(10000 - slippage * 100))) / BigInt(10000);
    const minAmount1 = (balance1 * BigInt(Math.floor(10000 - slippage * 100))) / BigInt(10000);
    
    // Set deadline (20 minutes)
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    
    console.log(`Adding liquidity with:
      Token A: ${ethers.formatUnits(balance0, tokenSymbols[0] === 'USDC' ? 6 : 18)} ${tokenSymbols[0]}
      Token B: ${ethers.formatUnits(balance1, tokenSymbols[1] === 'USDC' ? 6 : 18)} ${tokenSymbols[1]}
      Slippage: ${slippage}%
      Min A: ${ethers.formatUnits(minAmount0, tokenSymbols[0] === 'USDC' ? 6 : 18)} ${tokenSymbols[0]}
      Min B: ${ethers.formatUnits(minAmount1, tokenSymbols[1] === 'USDC' ? 6 : 18)} ${tokenSymbols[1]}
    `);
    
    try {
      // Use a direct contract call through the ethers.js wallet
      const { wallet } = initializeProvider();
      
      // Define a direct way to call the contract function
      // This avoids using the private managerContract property
      const addLiquidityDirect = async () => {
        // Call the contract method directly using the manager address
        // Create an interface to call the function
        const abi = [
          "function addLiquidityAerodrome(address tokenA, address tokenB, bool stable, uint amountA, uint amountB, uint minAmountA, uint minAmountB, uint deadline) external returns (uint liquidity)"
        ];
        
        const contract = new ethers.Contract(managerAddress, abi, wallet);
        
        // Call the function
        const tx = await contract.addLiquidityAerodrome(
          token0,
          token1,
          stable,
          balance0,
          balance1,
          minAmount0,
          minAmount1,
          deadline,
          { gasLimit: 5000000 }
        );
        
        console.log("Add liquidity transaction submitted:", tx.hash);
        return await tx.wait();
      };
      
      const receipt = await addLiquidityDirect();
      console.log("Transaction confirmed:", receipt.transactionHash);
      
      // Build result object
      return {
        success: true,
        txHash: receipt.transactionHash,
        poolName,
        tokenA: {
          symbol: tokenSymbols[0],
          amount: ethers.formatUnits(balance0, tokenSymbols[0] === 'USDC' ? 6 : 18)
        },
        tokenB: {
          symbol: tokenSymbols[1],
          amount: ethers.formatUnits(balance1, tokenSymbols[1] === 'USDC' ? 6 : 18)
        },
        lpTokenInfo: {
          liquidity: 1n // Placeholder, we don't have the exact amount from the receipt
        }
      };
    } catch (error) {
      console.error("Error calling addLiquidityAerodrome:", error);
      return {
        success: false,
        message: `Failed to add liquidity: ${(error as Error).message}`
      };
    }
  } catch (error) {
    console.error("Error adding liquidity:", error);
    return { 
      success: false, 
      message: (error as Error).message 
    };
  }
};

// Add liquidity and automatically stake the LP tokens
export const addLiquidityAndStake = async (poolName: string): Promise<AddLiquidityAndStakeResult> => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    
    // First add liquidity to the pool using our own implementation
    let addLiquidityResult;
    try {
      // Use our own addLiquidity implementation instead of manager.addLiquidity
      addLiquidityResult = await addLiquidity(poolName);
    } catch (error) {
      return {
        success: false,
        message: `Failed to add liquidity: ${(error instanceof Error) ? error.message : String(error)}`,
        staked: false,
        stakeResult: {
          success: false,
          message: "Did not attempt staking because adding liquidity failed."
        }
      } as AddLiquidityAndStakeResult;
    }
    
    if (!addLiquidityResult.success) {
      return {
        ...addLiquidityResult,
        staked: false,
        stakeResult: {
          success: false,
          message: "Did not attempt staking because adding liquidity failed."
        }
      } as AddLiquidityAndStakeResult;
    }
    
    // Since we added liquidity successfully, try to find the pair address to stake
    try {
      // Find the LP token address using pair information
      const stable = poolName.toLowerCase().includes('stable');
      
      // Get the token symbols from the pool name
      const tokenSymbols = poolName.split('-');
      if (tokenSymbols.length !== 2) {
        return {
          ...addLiquidityResult,
          staked: false,
          stakeResult: {
            success: false,
            message: `Cannot parse token symbols from pool name: ${poolName}`
          }
        } as AddLiquidityAndStakeResult;
      }
      
      // Get addresses from token symbols
      const token0 = ADDRESSES.BASE[tokenSymbols[0]];
      const token1 = ADDRESSES.BASE[tokenSymbols[1]];
      
      if (!token0 || !token1) {
        return {
          ...addLiquidityResult,
          staked: false,
          stakeResult: {
            success: false,
            message: `Could not find addresses for tokens: ${tokenSymbols[0]}, ${tokenSymbols[1]}`
          }
        } as AddLiquidityAndStakeResult;
      }
      
      // Get the pair address from the router
      let lpTokenAddress;
      
      // Try to use getAerodromePair if it exists
      if (typeof manager.getAerodromePair === 'function') {
        lpTokenAddress = await manager.getAerodromePair(token0, token1, stable);
        console.log(`Found LP token address: ${lpTokenAddress}`);
      } else {
        // Use our own method to find the pair using factory
        console.log("Manager doesn't have getAerodromePair, using alternative method to find pair");
        return {
          ...addLiquidityResult,
          staked: false,
          stakeResult: {
            success: false,
            message: "Could not determine LP token address, staking skipped"
          }
        } as AddLiquidityAndStakeResult;
      }
      
      if (lpTokenAddress && lpTokenAddress !== "0x0000000000000000000000000000000000000000") {
        // Stake the LP tokens
        console.log(`Staking LP tokens at address: ${lpTokenAddress}`);
        const stakeResult = await manager.stakeLPTokens(lpTokenAddress, poolName, "MAX");
        
        return {
          ...addLiquidityResult,
          staked: true,
          stakeResult
        } as AddLiquidityAndStakeResult;
      } else {
        console.log("No valid LP token address found for staking");
        return {
          ...addLiquidityResult,
          staked: false,
          stakeResult: {
            success: false,
            message: "No valid LP token address found for staking"
          }
        } as AddLiquidityAndStakeResult;
      }
    } catch (stakeError) {
      console.error('Error staking LP tokens:', stakeError);
      return {
        ...addLiquidityResult,
        staked: false,
        stakeResult: {
          success: false,
          message: `Error staking LP tokens: ${(stakeError as Error).message}`
        }
      } as AddLiquidityAndStakeResult;
    }
  } catch (error) {
    console.error('Error in combined addLiquidity and stake operation:', error);
    throw error;
  }
};

// Deposit tokens to the manager
export const depositTokens = async (tokenSymbol: string, amount: number) => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    return await manager.depositTokens(tokenSymbol, amount);
  } catch (error) {
    console.error('Error depositing tokens:', error);
    throw error;
  }
}; 