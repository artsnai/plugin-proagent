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

// Define interface for the combined unstake and remove liquidity result
export interface UnstakeAndRemoveLiquidityResult {
  success: boolean;
  message?: string;
  txHash?: string;
  poolName?: string;
  unstaked: boolean;
  unstakeResult?: {
    success: boolean;
    message?: string;
    txHash?: string;
  };
  removed: boolean;
  removeResult?: {
    success: boolean;
    message?: string;
    txHash?: string;
    amountA?: string;
    amountB?: string;
  };
  error?: any;
}

// Define interface for withdrawal result
export interface WithdrawTokensResult {
  success: boolean;
  message?: string;
  txHash?: string;
  tokenSymbol?: string;
  amount?: number | string;
  error?: any;
}

// Define interface for claim rewards result
export interface ClaimRewardsResult {
  success: boolean;
  message?: string;
  txHash?: string;
  poolName?: string;
  lpToken?: string;
  gaugeAddress?: string;
  amountClaimed?: string;
  error?: any;
}

// Define interface for claim fees result
export interface ClaimFeesResult {
  success: boolean;
  message?: string;
  txHash?: string;
  tokenA?: string;
  tokenB?: string;
  poolName?: string;
  stable?: boolean;
  amount0Received?: bigint;
  amount1Received?: bigint;
  formattedAmount0?: string;
  formattedAmount1?: string;
  error?: any;
}

// Define interface for claimable fees result
export interface ClaimableFeesResult {
  success: boolean;
  message?: string;
  poolName: string;
  tokenA?: string;
  tokenB?: string;
  stable?: boolean;
  lpBalance?: bigint;
  claimable0?: bigint;
  claimable1?: bigint;
  formattedClaimable0?: string;
  formattedClaimable1?: string;
  token0Symbol?: string;
  token1Symbol?: string;
  error?: any;
}

// Define interface for create manager result
export interface CreateManagerResult {
  success: boolean;
  message?: string;
  txHash?: string;
  managerAddress?: string;
  alreadyExists?: boolean;
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

// Enhanced claimFees function with better return type
export const claimFees = async (tokenA: string, tokenB: string, stable: boolean): Promise<ClaimFeesResult> => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    
    console.log(`Claiming fees for ${tokenA}/${tokenB} (stable: ${stable})...`);
    const result = await manager.claimFees(tokenA, tokenB, stable);
    
    if (!result.success) {
      return {
        success: false,
        message: result.message || "Failed to claim fees",
        tokenA,
        tokenB,
        stable,
        error: result.error
      };
    }
    
    // Format return values
    return {
      success: true,
      message: "Successfully claimed fees",
      txHash: result.txHash,
      tokenA,
      tokenB,
      stable,
      amount0Received: result.amount0Received,
      amount1Received: result.amount1Received,
      formattedAmount0: result.amount0Received ? result.amount0Received.toString() : "0",
      formattedAmount1: result.amount1Received ? result.amount1Received.toString() : "0"
    };
  } catch (error) {
    console.error('Error claiming fees:', error);
    return {
      success: false,
      message: `Error claiming fees: ${(error as Error).message}`,
      tokenA,
      tokenB,
      stable,
      error
    };
  }
};

// Claim fees using pool name instead of token addresses
export const claimPoolFees = async (poolName: string): Promise<ClaimFeesResult> => {
  try {
    // Parse pool name to get token symbols
    const poolTokens = poolName.split('-');
    if (poolTokens.length !== 2) {
      return {
        success: false,
        message: `Invalid pool name format: ${poolName}. Expected format: TOKEN1-TOKEN2`,
        poolName
      };
    }
    
    // Get token addresses from ADDRESSES
    const manager = await getAerodromeManager();
    await manager.initialize();
    
    // Get addresses directly from the imported ADDRESSES
    const { ADDRESSES } = await import('./addresses');
    // Use BASE network addresses
    const addresses = ADDRESSES.BASE;
    
    const token0 = addresses[poolTokens[0]];
    const token1 = addresses[poolTokens[1]];
    
    if (!token0 || !token1) {
      return {
        success: false,
        message: `Could not find addresses for tokens: ${poolTokens[0]}, ${poolTokens[1]}`,
        poolName
      };
    }
    
    // Determine if stable pool
    const stable = poolName.toLowerCase().includes('stable');
    
    // Call claimFees with the token addresses
    const result = await claimFees(token0, token1, stable);
    
    // Add pool name to the result
    return {
      ...result,
      poolName
    };
  } catch (error) {
    console.error('Error claiming pool fees:', error);
    return {
      success: false,
      message: `Error claiming pool fees: ${(error as Error).message}`,
      poolName,
      error
    };
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

// Unstake all LP tokens and remove liquidity from a pool
export const unstakeAndRemoveLiquidity = async (poolName: string): Promise<UnstakeAndRemoveLiquidityResult> => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    
    // First get staked positions
    const positionsResult = await getStakedPositions();
    
    if (!positionsResult || !positionsResult.stakedPositions) {
      return {
        success: false,
        message: "Could not retrieve staked positions",
        unstaked: false,
        removed: false,
      };
    }
    
    // Find the staked position for this pool
    const stakedPosition = positionsResult.stakedPositions.find(
      position => position.poolName.toLowerCase() === poolName.toLowerCase()
    );
    
    if (!stakedPosition) {
      return {
        success: false,
        message: `No staked position found for ${poolName}`,
        unstaked: false,
        removed: false,
      };
    }
    
    // Unstake LP tokens
    let unstakeResult;
    try {
      console.log(`Unstaking LP tokens for ${poolName}...`);
      unstakeResult = await manager.unstakeLPTokens(
        stakedPosition.lpToken,
        poolName,
        stakedPosition.gauge,
        "MAX" // Unstake all tokens
      );
      
      if (!unstakeResult.success) {
        return {
          success: false,
          message: `Failed to unstake LP tokens: ${unstakeResult.message}`,
          unstaked: false,
          removed: false,
          unstakeResult
        };
      }
      
      console.log(`LP tokens unstaked successfully for ${poolName}`);
    } catch (unstakeError) {
      console.error('Error unstaking LP tokens:', unstakeError);
      return {
        success: false,
        message: `Error unstaking LP tokens: ${(unstakeError as Error).message}`,
        unstaked: false,
        removed: false,
        error: unstakeError
      };
    }
    
    // Now get LP positions to find the unstaked position
    const lpPositions = await manager.getLPPositions();
    
    if (!lpPositions.success || !lpPositions.positions) {
      return {
        success: true,
        message: "LP tokens unstaked but could not retrieve LP positions for removal",
        unstaked: true,
        unstakeResult,
        removed: false,
        poolName
      };
    }
    
    // Find the LP position for this pool
    const lpPosition = lpPositions.positions.find(
      position => position.poolName.toLowerCase() === poolName.toLowerCase()
    );
    
    if (!lpPosition) {
      return {
        success: true,
        message: "LP tokens unstaked but no LP position found for removal",
        unstaked: true,
        unstakeResult,
        removed: false,
        poolName
      };
    }
    
    // Remove liquidity
    let removeResult;
    try {
      console.log(`Removing liquidity for ${poolName}...`);
      removeResult = await manager.removeLiquidity(
        poolName,
        100 // Remove 100% of liquidity
      );
      
      if (!removeResult.success) {
        return {
          success: true,
          message: `LP tokens unstaked but failed to remove liquidity: ${removeResult.message}`,
          unstaked: true,
          unstakeResult,
          removed: false,
          removeResult,
          poolName
        };
      }
      
      console.log(`Liquidity removed successfully for ${poolName}`);
    } catch (removeError) {
      console.error('Error removing liquidity:', removeError);
      return {
        success: true,
        message: `LP tokens unstaked but error removing liquidity: ${(removeError as Error).message}`,
        unstaked: true,
        unstakeResult,
        removed: false,
        error: removeError,
        poolName
      };
    }
    
    // Success!
    return {
      success: true,
      message: `Successfully unstaked LP tokens and removed liquidity for ${poolName}`,
      txHash: removeResult.txHash,
      poolName,
      unstaked: true,
      unstakeResult,
      removed: true,
      removeResult
    };
    
  } catch (error) {
    console.error('Error in unstakeAndRemoveLiquidity operation:', error);
    return {
      success: false,
      message: `Error in operation: ${(error as Error).message}`,
      unstaked: false,
      removed: false,
      error
    };
  }
};

// Withdraw tokens from the manager
export const withdrawTokens = async (tokenSymbol: string, amount: number | string = "ALL"): Promise<WithdrawTokensResult> => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    
    // Check if amount is "MAX" or "ALL" and handle it properly
    let parsedAmount: number | "ALL" = "ALL";
    if (amount !== "ALL" && amount !== "MAX") {
      if (typeof amount === 'string') {
        parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount)) {
          return {
            success: false,
            message: `Invalid amount: ${amount}`
          };
        }
      } else {
        parsedAmount = amount;
      }
    }
    
    // Call the withdraw function
    console.log(`Withdrawing ${parsedAmount === "ALL" ? "all" : parsedAmount} ${tokenSymbol}...`);
    const result = await manager.withdrawTokens(tokenSymbol, parsedAmount);
    
    return {
      ...result,
      tokenSymbol,
      amount: parsedAmount
    };
  } catch (error) {
    console.error('Error withdrawing tokens:', error);
    return {
      success: false,
      message: `Error withdrawing tokens: ${(error as Error).message}`,
      tokenSymbol,
      amount,
      error
    };
  }
};

// Claim rewards from a specific pool
export const claimPoolRewards = async (poolName: string): Promise<ClaimRewardsResult> => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    
    // First get staked positions
    const positionsResult = await getStakedPositions();
    
    if (!positionsResult || !positionsResult.stakedPositions) {
      return {
        success: false,
        message: "Could not retrieve staked positions",
        poolName
      };
    }
    
    // Find the staked position for this pool
    const stakedPosition = positionsResult.stakedPositions.find(
      position => position.poolName.toLowerCase() === poolName.toLowerCase()
    );
    
    if (!stakedPosition) {
      return {
        success: false,
        message: `No staked position found for ${poolName}`,
        poolName
      };
    }
    
    // Check if there are any rewards to claim
    if (stakedPosition.earned === 0n || (typeof stakedPosition.earned === 'string' && stakedPosition.earned === '0')) {
      return {
        success: false,
        message: `No rewards to claim for ${poolName}`,
        poolName,
        lpToken: stakedPosition.lpToken,
        gaugeAddress: stakedPosition.gauge
      };
    }
    
    // Claim rewards
    console.log(`Claiming rewards for ${poolName}...`);
    const result = await manager.claimRewards(
      stakedPosition.lpToken,
      poolName,
      stakedPosition.gauge
    );
    
    if (!result.success) {
      return {
        success: false,
        message: `Failed to claim rewards: ${result.message}`,
        poolName,
        lpToken: stakedPosition.lpToken,
        gaugeAddress: stakedPosition.gauge
      };
    }
    
    // Get the earned amount that was claimed (if available)
    const amountClaimed = stakedPosition.formattedEarned || 
                          stakedPosition.earnedFormatted || 
                          "Unknown amount";
    
    console.log(`Rewards claimed successfully for ${poolName}`);
    return {
      success: true,
      message: `Successfully claimed ${amountClaimed} AERO rewards from ${poolName}`,
      txHash: result.txHash,
      poolName,
      lpToken: stakedPosition.lpToken,
      gaugeAddress: stakedPosition.gauge,
      amountClaimed
    };
    
  } catch (error) {
    console.error('Error claiming pool rewards:', error);
    return {
      success: false,
      message: `Error claiming rewards: ${(error as Error).message}`,
      poolName,
      error
    };
  }
};

// Claim rewards from all pools
export const claimAllPoolRewards = async (): Promise<ClaimRewardsResult[]> => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    
    // Call the claimAllRewards method
    console.log('Claiming rewards from all pools...');
    const result = await manager.claimAllRewards();
    
    if (!result.success) {
      return [{
        success: false,
        message: `Failed to claim rewards: ${result.message}`
      }];
    }
    
    // Process the results
    const claimResults: ClaimRewardsResult[] = [];
    
    if (result.results && Array.isArray(result.results)) {
      for (const poolResult of result.results) {
        claimResults.push({
          success: true,
          message: `Successfully claimed rewards from ${poolResult.poolName || 'a pool'}`,
          txHash: poolResult.txHash,
          poolName: poolResult.poolName,
          lpToken: poolResult.lpToken,
          gaugeAddress: poolResult.gaugeAddress
        });
      }
      
      console.log(`Successfully claimed rewards from ${claimResults.length} pools`);
    } else {
      // If no individual results were provided, create a generic success result
      // The transaction hash may not be available in the result
      claimResults.push({
        success: true,
        message: 'Successfully claimed rewards from all eligible pools'
      });
      
      console.log('Successfully claimed rewards from all eligible pools');
    }
    
    return claimResults;
    
  } catch (error) {
    console.error('Error claiming all pool rewards:', error);
    return [{
      success: false,
      message: `Error claiming all rewards: ${(error as Error).message}`,
      error
    }];
  }
};

// Get claimable fees for a specific pool
export const getPoolClaimableFees = async (poolName: string): Promise<ClaimableFeesResult> => {
  try {
    // Parse pool name to get token symbols
    const poolTokens = poolName.split('-');
    if (poolTokens.length !== 2) {
      return {
        success: false,
        message: `Invalid pool name format: ${poolName}. Expected format: TOKEN1-TOKEN2`,
        poolName
      };
    }
    
    const token0Symbol = poolTokens[0];
    const token1Symbol = poolTokens[1];
    
    // Get token addresses from ADDRESSES
    const manager = await getAerodromeManager();
    await manager.initialize();
    
    // Get addresses directly from the imported ADDRESSES
    const { ADDRESSES } = await import('./addresses');
    // Use BASE network addresses
    const addresses = ADDRESSES.BASE;
    
    const token0 = addresses[token0Symbol];
    const token1 = addresses[token1Symbol];
    
    if (!token0 || !token1) {
      return {
        success: false,
        message: `Could not find addresses for tokens: ${token0Symbol}, ${token1Symbol}`,
        poolName,
        token0Symbol,
        token1Symbol
      };
    }
    
    // Determine if stable pool
    const stable = poolName.toLowerCase().includes('stable');
    
    console.log(`Getting claimable fees for ${poolName}...`);
    const result = await manager.getClaimableFees(token0, token1, stable);
    
    if (!result.success) {
      return {
        success: false,
        message: result.message || "Failed to get claimable fees",
        poolName,
        tokenA: token0,
        tokenB: token1,
        stable,
        token0Symbol,
        token1Symbol
      };
    }
    
    // Try to format the claimable amounts
    let formattedClaimable0 = "0";
    let formattedClaimable1 = "0";
    
    try {
      const { ethers } = await import('ethers');
      // Find token decimals - default to 18, use 6 for USDC
      const decimals0 = token0Symbol === 'USDC' ? 6 : 18;
      const decimals1 = token1Symbol === 'USDC' ? 6 : 18;
      
      formattedClaimable0 = ethers.formatUnits(result.claimable0 || 0, decimals0);
      formattedClaimable1 = ethers.formatUnits(result.claimable1 || 0, decimals1);
    } catch (error) {
      console.warn("Error formatting claimable amounts:", error);
      // Fall back to simple string conversion
      formattedClaimable0 = (result.claimable0 || 0).toString();
      formattedClaimable1 = (result.claimable1 || 0).toString();
    }
    
    return {
      success: true,
      poolName,
      tokenA: token0,
      tokenB: token1,
      stable,
      lpBalance: result.lpBalance,
      claimable0: result.claimable0 || result.claimable0Amount,
      claimable1: result.claimable1 || result.claimable1Amount,
      formattedClaimable0,
      formattedClaimable1,
      token0Symbol,
      token1Symbol
    };
  } catch (error) {
    console.error('Error getting claimable fees:', error);
    return {
      success: false,
      message: `Error getting claimable fees: ${(error as Error).message}`,
      poolName,
      error
    };
  }
};

// Get claimable fees for all active pools
export const getAllClaimableFees = async (): Promise<ClaimableFeesResult[]> => {
  try {
    const manager = await getAerodromeManager();
    await manager.initialize();
    
    // First get positions to find active pools
    const positionsResult = await manager.getLPPositions();
    
    if (!positionsResult.success || !positionsResult.positions || positionsResult.positions.length === 0) {
      return [{
        success: false,
        message: "No active LP positions found",
        poolName: "None"
      }];
    }
    
    const positions = positionsResult.positions;
    const results: ClaimableFeesResult[] = [];
    
    // Process each position
    for (const position of positions) {
      const poolName = position.poolName || "Unknown Pool";
      
      // Skip if we couldn't determine the pool name
      if (poolName === "Unknown Pool") {
        continue;
      }
      
      try {
        // Get claimable fees for this pool
        const result = await getPoolClaimableFees(poolName);
        results.push(result);
      } catch (error) {
        console.error(`Error getting fees for ${poolName}:`, error);
        results.push({
          success: false,
          message: `Error: ${(error as Error).message}`,
          poolName
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error getting all claimable fees:', error);
    return [{
      success: false,
      message: `Error getting all claimable fees: ${(error as Error).message}`,
      poolName: "All Pools",
      error
    }];
  }
};

// Create a new manager contract
export const createNewManager = async (): Promise<CreateManagerResult> => {
  try {
    const manager = await getAerodromeManager();
    
    // Check if a manager already exists (initialize will return success: false if no manager exists)
    const initResult = await manager.initialize();
    
    if (initResult.success && initResult.managerAddress) {
      return {
        success: true,
        message: "You already have a manager contract",
        managerAddress: initResult.managerAddress,
        alreadyExists: true
      };
    }
    
    // Create a new manager
    console.log("Creating new manager contract...");
    const result = await manager.createManager();
    
    if (!result.success) {
      return {
        success: false,
        message: result.message || "Failed to create manager contract",
        error: result.error
      };
    }
    
    console.log(`Manager created successfully at ${result.managerAddress}`);
    
    // Initialize the manager to set the factory address properly
    const postInitResult = await manager.initialize();
    
    if (!postInitResult.success) {
      return {
        success: true,
        message: `Manager created at ${result.managerAddress}, but initialization failed: ${postInitResult.message}`,
        managerAddress: result.managerAddress,
        txHash: result.txHash
      };
    }
    
    return {
      success: true,
      message: "Manager created and initialized successfully",
      managerAddress: result.managerAddress,
      txHash: result.txHash
    };
  } catch (error) {
    console.error('Error creating manager:', error);
    return {
      success: false,
      message: `Error creating manager: ${(error as Error).message}`,
      error
    };
  }
}; 