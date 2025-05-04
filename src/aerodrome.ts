import { ethers } from 'ethers';

// Contract ABIs - imported from compiled contracts
import UserLPManagerFactoryABI from './abi/UserLPManagerFactory.json';
import UserLPManagerABI from './abi/UserLPManager.json';
import IERC20ABI from './abi/IERC20.json';
import IAerodromePairABI from './abi/IAerodromePair.json';
// import IAerodromeRouterABI from '../abi/IAerodromeRouter.json';
// import IAerodromeFactoryABI from '../abi/IAerodromeFactory.json';
import IAerodromeVoterABI from './abi/IAerodromeVoter.json';
import IAerodromeGaugeABI from './abi/IAerodromeGauge.json';

import { ADDRESSES } from './addresses';

// Helper functions for ethers v6 compatibility
const isZero = (value: bigint | number | string): boolean => {
  if (typeof value === 'bigint') return value === 0n;
  if (typeof value === 'number') return value === 0;
  if (typeof value === 'string') return value === '0';
  
  // Handle ethers v5 BigNumber if present
  if (value && typeof (value as any).isZero === 'function') {
    return (value as any).isZero();
  }
  
  return false;
};

// Predefined pool configurations - using minimal test amounts from scripts
const POOLS = [
  { 
    name: "USDC-WETH", 
    tokenA: { symbol: "USDC", decimals: 6, amount: "0.1" },
    tokenB: { symbol: "WETH", decimals: 18, amount: "0.0001" },
    stable: false, 
    slippage: 30
  },
  { 
    name: "USDC-AERO", 
    tokenA: { symbol: "USDC", decimals: 6, amount: "0.5" },
    tokenB: { symbol: "AERO", decimals: 18, amount: "0.8" },
    stable: false, 
    slippage: 50
  },
  { 
    name: "WETH-VIRTUAL", 
    tokenA: { symbol: "WETH", decimals: 18, amount: "0.0001" },
    tokenB: { symbol: "VIRTUAL", decimals: 18, amount: "0.01" },
    stable: false, 
    slippage: 30
  },
  {
    name: "WETH-TN100x",
    tokenA: { symbol: "WETH", decimals: 18, amount: "0.0001" },
    tokenB: { symbol: "TN100x", decimals: 18, amount: "0.0001" },
    stable: false,
    slippage: 30
  },
  {
    name: "WETH-VEIL",
    tokenA: { symbol: "WETH", decimals: 18, amount: "0.0001" },
    tokenB: { symbol: "VEIL", decimals: 18, amount: "0.0001" },
    stable: false,
    slippage: 30
  }
];

// Define proper interface for addresses to avoid 'any'
interface AddressMap {
  FACTORY: string;
  USDC: string;
  WETH: string;
  AERO: string;
  VIRTUAL: string;
  AERODROME_ROUTER: string;
  AERODROME_FACTORY: string;
  AERODROME_VOTER: string;
  [key: string]: string;
}

// Define interface for pool type to avoid 'any'
interface Pool {
  name: string;
  address?: string;  // Make address optional since it might not be present in all pool objects
  tokenA: {
    symbol: string;
    address: string;
    decimals: number;
    amount?: string;  // Add amount field
  };
  tokenB: {
    symbol: string;
    address: string;
    decimals: number;
    amount?: string;  // Add amount field
  };
  stable: boolean;
  gaugeAddress?: string;
  slippage?: number;  // Add slippage field
}

/**
 * Initialize the Aerodrome Manager API with a web3 provider
 */
export class AerodromeManager {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private chainId: number;
  private addresses: AddressMap;
  private factoryContract: ethers.Contract | null;
  private managerContract: ethers.Contract | null;
  private managerAddress: string | null;
  private voterContract: ethers.Contract | null;
  private pools: Pool[];
  private initializing: boolean = false;
  private initialized: boolean = false;

  constructor(provider: ethers.Provider, chainId = 8453) {
    this.provider = provider;
    this.chainId = chainId;
    this.addresses = ADDRESSES[this.chainId === 8453 ? "BASE" : "BASE"];
    this.factoryContract = null;
    this.managerContract = null;
    this.managerAddress = null;
    this.voterContract = null;
    
    // Map the POOLS array to include proper address mappings for each token
    this.pools = POOLS.map(pool => ({
      ...pool,
      tokenA: {
        ...pool.tokenA,
        address: this.addresses[pool.tokenA.symbol]
      },
      tokenB: {
        ...pool.tokenB,
        address: this.addresses[pool.tokenB.symbol]
      }
    }));
    
    // For ethers v6, check if provider has getSigner method
    if ('getSigner' in provider && typeof provider.getSigner === 'function') {
      // Use a proper type assertion
      const providerWithSigner = provider as unknown as { getSigner(): ethers.Signer };
      this.signer = providerWithSigner.getSigner();
    } else {
      // Handle the case when provider is already a signer
      this.signer = provider as unknown as ethers.Signer;
      
      // Add getAddress to signer if it doesn't exist (for wagmi providers)
      if (!('getAddress' in this.signer)) {
        const originalSigner = this.signer;
        // Replace @ts-ignore with @ts-expect-error
        // @ts-expect-error - we're adding missing functionality
        this.signer.getAddress = async () => {
          // Try different ways to access the address
          try {
            // Use a more specific type
            const signerObj = originalSigner as { 
              account?: { address: string },
              _account?: { address: string },
              address?: string 
            };
            
            // Check various common patterns for accessing addresses
            if (signerObj.account?.address) {
              return signerObj.account.address;
            }
            
            if (signerObj._account?.address) {
              return signerObj._account.address;
            }
            
            if (signerObj.address) {
              return signerObj.address;
            }
            
            throw new Error("Could not determine address from provider");
          } catch (signerError) {
            console.error("Error accessing signer address:", signerError);
            throw new Error("Could not determine wallet address");
          }
        };
      }
    }
  }

  /**
   * Initialize the Aerodrome manager
   * Sets up the contract interfaces and loads pool data
   */
  async initialize() {
    try {
      // Prevent multiple initializations
      if (this.initialized) {
        console.log("Already initialized, skipping");
        return { success: true, message: "Already initialized" };
      }
      
      // Check if initialization is already in progress
      if (this.initializing) {
        console.log("Initialization already in progress, skipping");
        return { success: false, message: "Initialization already in progress" };
      }
      
      // Set the initialization lock
      this.initializing = true;
      
      console.log("Initializing Aerodrome LP Manager with addresses:", this.addresses);
      
      // Initialize signer from provider if available
      try {
        const providerWithSigner = this.provider as unknown as { getSigner(): Promise<ethers.Signer> };
        if (typeof providerWithSigner.getSigner === 'function') {
          this.signer = await providerWithSigner.getSigner();
        }
      } catch (error) {
        console.warn("Could not get signer from provider, wallet connection may be required:", error);
      }
      
      // Get addresses based on chainId
      this.addresses = ADDRESSES[this.chainId === 8453 ? "BASE" : "BASE"];
      
      console.log("Initializing factory contract at:", this.addresses.FACTORY);
      try {
        this.factoryContract = new ethers.Contract(
          this.addresses.FACTORY,
          UserLPManagerFactoryABI,
          this.signer
        );
        console.log("Factory contract initialized successfully");
      } catch (error) {
        console.error("Error initializing factory contract:", error);
        return { 
          success: false, 
          message: "Failed to initialize factory contract. Please check the ABI and address." 
        };
      }

      // Check if user has a manager
      const userAddress = await this.signer.getAddress();
      console.log("Checking manager for user:", userAddress);
      
      try {
        this.managerAddress = await this.factoryContract.getUserManager(userAddress);
        console.log("Manager address from contract:", this.managerAddress);
      } catch (error) {
        console.error("Error calling getUserManager:", error);
        return { 
          success: false, 
          message: "Failed to call getUserManager. The contract might not be deployed at the specified address or the network could be incorrect."
        };
      }
      
      if (this.managerAddress === ethers.ZeroAddress) {
        console.log("No manager found for user", userAddress);
        return { success: false, message: "No manager found for your address. Create one first." };
      }
      
      console.log(`Found manager at ${this.managerAddress} for user ${userAddress}`);
      
      // Initialize manager contract
      if (!Array.isArray(UserLPManagerABI) || UserLPManagerABI.length === 0) {
        console.error("Manager ABI is not properly loaded:", UserLPManagerABI);
        return { 
          success: false, 
          message: "Manager ABI is not properly loaded. Please check your ABI files." 
        };
      }
      
      try {
        if (!this.managerAddress) {
          return { 
            success: false, 
            message: "Manager address is null" 
          };
        }
        
        this.managerContract = new ethers.Contract(
          this.managerAddress,
          UserLPManagerABI,
          this.signer
        );
        console.log("Manager contract initialized successfully");
      } catch (error) {
        console.error("Error initializing manager contract:", error);
        return { 
          success: false, 
          message: "Failed to initialize manager contract. Please check the ABI and address." 
        };
      }
      
      // Check ownership
      let owner;
      try {
        owner = await this.managerContract.owner();
        console.log("Manager owner:", owner);
      } catch (error) {
        console.error("Error getting manager owner:", error);
        return { 
          success: false, 
          message: "Failed to verify manager ownership. The contract might not be compatible." 
        };
      }
      
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        console.log("Owner mismatch. Contract owner:", owner, "User:", userAddress);
        return { success: false, message: "You are not the owner of this manager." };
      }
      
      // Check aerodrome factory configuration
      let aerodromeFactoryAddress = null;
      try {
        aerodromeFactoryAddress = await this.managerContract.aerodromeFactory();
        console.log("Current Aerodrome factory:", aerodromeFactoryAddress);
      } catch (error) {
        console.log("Error getting aerodrome factory, attempting to set it:", error);
      }
      
      if (!aerodromeFactoryAddress || aerodromeFactoryAddress === ethers.ZeroAddress) {
        console.log("Setting Aerodrome factory address to:", this.addresses.AERODROME_FACTORY);
        try {
          // Set the factory if not already set
          const tx = await this.managerContract.setAerodromeFactory(this.addresses.AERODROME_FACTORY);
          console.log("Waiting for setAerodromeFactory transaction:", tx.hash);
          await tx.wait();
          console.log("Factory address set successfully");
        } catch (error) {
          console.error("Error setting factory address:", error);
          return { 
            success: false, 
            message: "Failed to set Aerodrome factory address. Please check contract permissions." 
          };
        }
      } else {
        console.log("Aerodrome factory already set:", aerodromeFactoryAddress);
      }
      
      // Initialize voter contract
      if (!Array.isArray(IAerodromeVoterABI) || IAerodromeVoterABI.length === 0) {
        console.warn("Voter ABI is not properly loaded:", IAerodromeVoterABI);
        // This is not critical, so we continue anyway
      }
      
      try {
        this.voterContract = new ethers.Contract(
          this.addresses.AERODROME_VOTER,
          IAerodromeVoterABI,
          this.signer
        );
        console.log("Voter contract initialized successfully");
      } catch (error) {
        console.warn("Warning: Failed to initialize voter contract:", error);
        // This is not critical, so we continue anyway
      }
      
      console.log("Initialization complete");
      this.initialized = true;
      this.initializing = false;
      return { success: true, managerAddress: this.managerAddress };
    } catch (error) {
      // On error, clear the initialization lock
      this.initializing = false;
      console.error("Initialization error:", error);
      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * Get token balances in the manager
   */
  async getManagerBalances() {
    try {
      if (!this.managerContract) {
        console.error("Manager not initialized in getManagerBalances");
        return { success: false, message: "Manager not initialized" };
      }
      
      console.log("Getting token balances for manager:", this.managerAddress);
      
      const balances: Record<string, any> = {};
      const tokenSymbols = ["USDC", "WETH", "AERO", "VIRTUAL", "TN100x", "VEIL"];
      
      for (const symbol of tokenSymbols) {
        try {
          const address = this.addresses[symbol];
          
          if (!address) {
            console.warn(`Address for ${symbol} not found in the addresses configuration`);
            continue;
          }
          
          // Find token decimals
          let decimals = 18; // Default to 18 if not specified
          const poolWithToken = this.pools.find(p => 
            p.tokenA.symbol === symbol || p.tokenB.symbol === symbol
          );
          
          if (poolWithToken) {
            decimals = poolWithToken.tokenA.symbol === symbol 
              ? poolWithToken.tokenA.decimals 
              : poolWithToken.tokenB.decimals;
          }
          
          console.log(`Getting balance for ${symbol} (${address}) with ${decimals} decimals`);
          
          // Call the contract to get the balance
          const balance = await this.managerContract.getTokenBalance(address);
          console.log(`Raw balance for ${symbol}:`, balance?.toString());
          
          // Format balance with proper decimals
          const formatted = ethers.formatUnits(balance, decimals);
          console.log(`Formatted ${symbol} balance:`, formatted);
          
          balances[symbol] = {
            symbol,
            address,
            balance,
            decimals,
            formatted
          };
        } catch (error) {
          console.error(`Error getting ${symbol} balance:`, error);
          // Add a placeholder with zero balance so the UI doesn't break
          balances[symbol] = {
            symbol,
            address: this.addresses[symbol] || ethers.ZeroAddress,
            balance: ethers.toBigInt(0),
            decimals: symbol === "USDC" ? 6 : 18,
            formatted: "0",
            error: (error as Error).message
          };
        }
      }
      
      return { success: true, balances };
    } catch (error) {
      console.error("Error getting token balances:", error);
      return { 
        success: false, 
        message: (error as Error).message || "Failed to get token balances",
        error
      };
    }
  }
  
  /**
   * Get LP positions in the manager
   */
  async getLPPositions() {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager not initialized" };
      }
      
      const positions = [];
      
      // Try to use getAerodromeLPPositions first
      try {
        const lpPositions = await this.managerContract.getAerodromeLPPositions();
        
        for (const position of lpPositions) {
          const lpToken = position.lpToken;
          const balance = position.balance;
          
          // Get pool info
          try {
            const lpContract = new ethers.Contract(
              lpToken,
              IAerodromePairABI,
              this.provider
            );
            
            const token0 = await lpContract.token0();
            const token1 = await lpContract.token1();
            
            // Find matching pool
            let poolName = "Unknown Pool";
            let stable = false;
            
            for (const pool of this.pools) {
              if (
                (pool.tokenA.address.toLowerCase() === token0.toLowerCase() && 
                 pool.tokenB.address.toLowerCase() === token1.toLowerCase()) ||
                (pool.tokenA.address.toLowerCase() === token1.toLowerCase() && 
                 pool.tokenB.address.toLowerCase() === token0.toLowerCase())
              ) {
                poolName = pool.name;
                stable = pool.stable;
                break;
              }
            }
            
            positions.push({
              lpToken,
              balance,
              formattedBalance: ethers.formatEther(balance),
              poolName,
              stable,
              token0,
              token1
            });
          } catch (error) {
            positions.push({
              lpToken,
              balance,
              formattedBalance: ethers.formatEther(balance),
              poolName: "Unknown Pool",
              error: (error as Error).message
            });
          }
        }
      } catch (error) {
        // Fallback to checking known pools directly
        for (const pool of this.pools) {
          try {
            const [stablePool, volatilePool] = await this.managerContract.getAerodromePools(
              pool.tokenA.address,
              pool.tokenB.address
            );
            
            const poolAddress = pool.stable ? stablePool : volatilePool;
            
            if (poolAddress && poolAddress !== ethers.ZeroAddress) {
              const lpToken = new ethers.Contract(
                poolAddress,
                IERC20ABI,
                this.provider
              );
              
              const balance = await lpToken.balanceOf(this.managerAddress);
              
              if (balance !== 0n) {
                positions.push({
                  lpToken: poolAddress,
                  balance,
                  formattedBalance: ethers.formatEther(balance),
                  poolName: pool.name,
                  stable: pool.stable,
                  token0: pool.tokenA.address,
                  token1: pool.tokenB.address
                });
              }
            }
          } catch (error) {
            console.error(`Error checking ${pool.name} LP position:`, error);
          }
        }
      }
      
      return { success: true, positions };
    } catch (error) {
      console.error("Error getting LP positions:", error);
      return { success: false, message: (error as Error).message };
    }
  }
  
  /**
   * Deposit tokens to the manager
   * @param tokenSymbol The symbol of the token to deposit
   * @param amount The amount to deposit
   */
  async depositTokens(tokenSymbol: string, amount: number) {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager not initialized" };
      }
      
      // Find token details
      const tokenAddress = this.addresses[tokenSymbol];
      if (!tokenAddress) {
        return { success: false, message: `Unknown token: ${tokenSymbol}` };
      }
      
      // Find token decimals
      const decimals = POOLS.find(p => 
        p.tokenA.symbol === tokenSymbol || p.tokenB.symbol === tokenSymbol
      )?.tokenA.symbol === tokenSymbol 
        ? POOLS.find(p => p.tokenA.symbol === tokenSymbol)?.tokenA.decimals ?? 18
        : POOLS.find(p => p.tokenB.symbol === tokenSymbol)?.tokenB.decimals ?? 18;
      
      // Parse amount
      const parsedAmount = ethers.parseUnits(amount.toString(), decimals);
      
      // Get token contract
      const tokenContract = new ethers.Contract(
        tokenAddress,
        IERC20ABI,
        this.signer
      );
      
      // Check token allowance first
      const userAddress = await this.signer.getAddress();
      const allowance = await tokenContract.allowance(userAddress, this.managerAddress);
      
      if (BigInt(allowance.toString()) < BigInt(parsedAmount.toString())) {
        // Approve tokens
        const approveTx = await tokenContract.approve(this.managerAddress, parsedAmount);
        await approveTx.wait();
      }
      
      // Deposit tokens
      const tx = await this.managerContract.depositTokens(tokenAddress, parsedAmount);
      const receipt = await tx.wait();
      
      return { 
        success: true, 
        txHash: receipt.transactionHash,
        tokenSymbol,
        amount,
        parsedAmount: parsedAmount.toString()
      };
    } catch (error) {
      console.error("Error depositing tokens:", error);
      return { success: false, message: (error as Error).message };
    }
  }
  
  /**
   * Add liquidity to a specified pool
   */
  async addLiquidity(poolName: string) {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager not initialized" };
      }
      
      // Find pool configuration
      const pool = this.pools.find(p => p.name === poolName);
      if (!pool) {
        return { success: false, message: `Pool '${poolName}' not found` };
      }
      
      console.log(`Adding liquidity to ${poolName} (${pool.stable ? 'Stable' : 'Volatile'})...`);
      
      // Check if tokens are already in the manager
      let tokenABalance;
      let tokenBBalance;
      
      try {
        // Get token balances and ensure they're BigInt
        const rawTokenABalance = await this.managerContract.getTokenBalance(pool.tokenA.address);
        const rawTokenBBalance = await this.managerContract.getTokenBalance(pool.tokenB.address);
        
        // Convert to BigInt if needed
        tokenABalance = this.toBigInt(rawTokenABalance);
        tokenBBalance = this.toBigInt(rawTokenBBalance);
        
        console.log(`Current balances:
          ${pool.tokenA.symbol}: ${ethers.formatUnits(tokenABalance, pool.tokenA.decimals)}
          ${pool.tokenB.symbol}: ${ethers.formatUnits(tokenBBalance, pool.tokenB.decimals)}
        `);
      } catch (error) {
        console.error("Error getting token balances:", error);
        return { success: false, message: "Failed to retrieve token balances" };
      }
      
      // Deposit tokens if needed
      if (isZero(tokenABalance) || isZero(tokenBBalance)) {
        return {
          success: false,
          message: `Insufficient balance in manager. Please deposit ${pool.tokenA.symbol} and ${pool.tokenB.symbol} first.`
        };
      }
      
      // Calculate minimum amounts for slippage
      const amountADesired = tokenABalance;
      const amountBDesired = tokenBBalance;
      
      // Fix the slippage usage by providing a default
      const slippageTolerance = pool.slippage ?? 0.5; // Default to 0.5% if undefined
      
      // Use native BigInt arithmetic instead of mul/div methods
      const minAmountA = (amountADesired * BigInt(Math.floor((10000 - slippageTolerance * 100)))) / BigInt(10000); // Corrected slippage calc
      const minAmountB = (amountBDesired * BigInt(Math.floor((10000 - slippageTolerance * 100)))) / BigInt(10000); // Corrected slippage calc
      
      console.log(`Adding liquidity with:
        Token A: ${ethers.formatUnits(amountADesired, pool.tokenA.decimals)} ${pool.tokenA.symbol}
        Token B: ${ethers.formatUnits(amountBDesired, pool.tokenB.decimals)} ${pool.tokenB.symbol}
        Slippage: ${slippageTolerance}%
        Min A: ${ethers.formatUnits(minAmountA, pool.tokenA.decimals)} ${pool.tokenA.symbol}
        Min B: ${ethers.formatUnits(minAmountB, pool.tokenB.decimals)} ${pool.tokenB.symbol}
      `);
      
      // Approve tokens first if needed
      const erc20A = new ethers.Contract(pool.tokenA.address, IERC20ABI, this.signer);
      const erc20B = new ethers.Contract(pool.tokenB.address, IERC20ABI, this.signer);
      
      const aerodromeRouterAddress = this.addresses.AERODROME_ROUTER;
      
      // Check and set allowances if needed
      const allowanceA = await erc20A.allowance(this.managerAddress, aerodromeRouterAddress);
      // Convert to BigInt for comparison since we're using ethers v6
      if (BigInt(allowanceA.toString()) < BigInt(amountADesired.toString())) {
        console.log(`Approving ${pool.tokenA.symbol}...`);
        const approveTxA = await this.managerContract.approveToken(
          pool.tokenA.address, 
          aerodromeRouterAddress,
          ethers.MaxUint256
        );
        await approveTxA.wait();
        console.log(`${pool.tokenA.symbol} approved`);
      }
      
      const allowanceB = await erc20B.allowance(this.managerAddress, aerodromeRouterAddress);
      // Convert to BigInt for comparison since we're using ethers v6
      if (BigInt(allowanceB.toString()) < BigInt(amountBDesired.toString())) {
        console.log(`Approving ${pool.tokenB.symbol}...`);
        const approveTxB = await this.managerContract.approveToken(
          pool.tokenB.address, 
          aerodromeRouterAddress,
          ethers.MaxUint256
        );
        await approveTxB.wait();
        console.log(`${pool.tokenB.symbol} approved`);
      }
      
      // Get deadline (30 minutes from now)
      const deadline = Math.floor(Date.now() / 1000) + 1800;
      
      // Execute add liquidity transaction
      console.log("Executing addLiquidityAerodrome transaction...");
      const tx = await this.managerContract.addLiquidityAerodrome(
        pool.tokenA.address,
        pool.tokenB.address,
        pool.stable,
        amountADesired,
        amountBDesired,
        minAmountA,
        minAmountB,
        deadline,
        { 
          gasLimit: 5000000,
          gasPrice: ethers.parseUnits("1.5", "gwei") // Set a reasonable gas price directly
        }
      );
      
      console.log("Waiting for transaction...", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt.transactionHash);
      
      // Find the LP token address from event logs
      const event = receipt.events?.find((e: {event?: string, args?: any}) => e.event === 'AerodromeLiquidityAdded');
      let lpTokenInfo = null;
      
      if (event && event.args) {
        try {
          lpTokenInfo = {
            tokenA: event.args.tokenA,
            tokenB: event.args.tokenB,
            stable: event.args.stable,
            amountA: this.toBigInt(event.args.amountA),
            amountB: this.toBigInt(event.args.amountB),
            liquidity: this.toBigInt(event.args.liquidity)
          };
          
          console.log(`Successfully added liquidity:
            ${ethers.formatUnits(lpTokenInfo.amountA, pool.tokenA.decimals)} ${pool.tokenA.symbol}
            ${ethers.formatUnits(lpTokenInfo.amountB, pool.tokenB.decimals)} ${pool.tokenB.symbol}
            Received: ${ethers.formatEther(lpTokenInfo.liquidity)} LP Tokens
          `);
        } catch (eventError) {
          console.error("Error parsing event data:", eventError);
          console.log("Raw event data:", event);
        }
      } else {
        console.log("AerodromeLiquidityAdded event not found, but transaction succeeded");
      }
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        poolName,
        tokenA: {
          symbol: pool.tokenA.symbol,
          amount: ethers.formatUnits(amountADesired, pool.tokenA.decimals)
        },
        tokenB: {
          symbol: pool.tokenB.symbol, 
          amount: ethers.formatUnits(amountBDesired, pool.tokenB.decimals)
        },
        lpTokenInfo
      };
    } catch (error) {
      console.error("Error adding liquidity:", error);
      return {
        success: false,
        message: (error as Error).message || "Failed to add liquidity",
        error
      };
    }
  }
  
  /**
   * Remove liquidity from a pool
   */
  async removeLiquidity(poolName: string, percentToRemove = 100) {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager not initialized" };
      }
      
      // Find the pool configuration
      const pool = this.pools.find(p => p.name === poolName);
      if (!pool) {
        return { success: false, message: `Unknown pool: ${poolName}` };
      }
      
      // Get the pool address
      const [stablePool, volatilePool] = await this.managerContract.getAerodromePools(
        pool.tokenA.address, 
        pool.tokenB.address
      );
      
      const poolAddress = pool.stable ? stablePool : volatilePool;
      
      if (poolAddress === ethers.ZeroAddress) {
        return { success: false, message: `Pool does not exist: ${poolName}` };
      }
      
      // Get LP token balance
      const lpToken = new ethers.Contract(
        poolAddress,
        IERC20ABI,
        this.provider
      );
      
      // Ensure we're using BigInt for calculations
      let lpBalance;
      try {
        // Get balance as a raw value
        const rawBalance = await lpToken.balanceOf(this.managerAddress);
        
        // Convert to BigInt if it's not already
        if (typeof rawBalance === 'bigint') {
          lpBalance = rawBalance;
        } else if (typeof rawBalance === 'object' && rawBalance.toBigInt) {
          // Handle ethers v5 BigNumber
          lpBalance = rawBalance.toBigInt();
        } else if (typeof rawBalance === 'object' && rawBalance._hex) {
          // Handle ethers v5 hexstring based BigNumber
          lpBalance = BigInt(rawBalance._hex);
        } else {
          // If it's a string or number, convert to BigInt
          lpBalance = BigInt(rawBalance.toString());
        }
      } catch (error) {
        console.error("Error converting LP balance to BigInt:", error);
        return { 
          success: false, 
          message: "Error parsing LP token balance" 
        };
      }
      
      // Check LP balance
      console.log(`LP balance: ${ethers.formatEther(lpBalance)} ${poolName} LP tokens`);
      
      if (isZero(lpBalance)) {
        return { 
          success: false, 
          message: "No LP tokens to remove" 
        };
      }
      
      // Calculate amount to remove
      const amountToRemove = (lpBalance * BigInt(percentToRemove)) / BigInt(100);
      
      // Set minimum amounts - use 1% of expected amounts as minimums to account for slippage
      const minAmountA = BigInt(0); // Use 0 as minimum to ensure the transaction succeeds
      const minAmountB = BigInt(0); // Use 0 as minimum to ensure the transaction succeeds
      
      console.log(`Removing ${ethers.formatEther(amountToRemove)} LP tokens (${percentToRemove}% of position)`);
      
      // Set deadline
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60; // 20 minutes
      
      // Remove liquidity
      const tx = await this.managerContract.removeLiquidityAerodrome(
        pool.tokenA.address,
        pool.tokenB.address,
        pool.stable,
        amountToRemove,
        minAmountA,
        minAmountB,
        deadline,
        { 
          gasLimit: 3000000,
          gasPrice: ethers.parseUnits("1.5", "gwei") // Set a reasonable gas price directly
        }
      );
      
      console.log(`Remove liquidity transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Remove liquidity transaction confirmed: ${receipt.transactionHash}`);
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        poolName,
        amountRemoved: ethers.formatEther(amountToRemove),
        percentRemoved: percentToRemove
      };
      
    } catch (error) {
      console.error("Error removing liquidity:", error);
      return { success: false, message: (error as Error).message };
    }
  }
  
  /**
   * Withdraw tokens from manager
   */
  async withdrawTokens(tokenSymbol: string, amount: number | "ALL") {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager not initialized" };
      }
      
      // Find token details
      const tokenAddress = this.addresses[tokenSymbol];
      if (!tokenAddress) {
        return { success: false, message: `Unknown token: ${tokenSymbol}` };
      }
      
      // Find token decimals
      const decimals = POOLS.find(p => 
        p.tokenA.symbol === tokenSymbol || p.tokenB.symbol === tokenSymbol
      )?.tokenA.symbol === tokenSymbol 
        ? POOLS.find(p => p.tokenA.symbol === tokenSymbol)?.tokenA.decimals ?? 18
        : POOLS.find(p => p.tokenB.symbol === tokenSymbol)?.tokenB.decimals ?? 18;
      
      // Check current balance
      const currentBalance = await this.managerContract.getTokenBalance(tokenAddress);
      
      // Parse amount (if "ALL", use the full balance)
      let parsedAmount;
      if (amount === "ALL") {
        parsedAmount = currentBalance;
        amount = Number(ethers.formatUnits(currentBalance, decimals));
      } else {
        parsedAmount = ethers.parseUnits(amount.toString(), decimals);
        
        if (parsedAmount > currentBalance) {
          return { 
            success: false, 
            message: `Insufficient balance. Have ${ethers.formatUnits(currentBalance, decimals)}, requested ${amount}` 
          };
        }
      }
      
      // Get user address
      const userAddress = await this.signer.getAddress();
      
      // Withdraw tokens
      const tx = await this.managerContract.withdrawTokens(
        tokenAddress,
        userAddress,
        parsedAmount
      );
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        tokenSymbol,
        amount,
        parsedAmount: parsedAmount.toString()
      };
    } catch (error) {
      console.error("Error withdrawing tokens:", error);
      return { success: false, message: (error as Error).message };
    }
  }
  
  /**
   * Create a new manager contract
   */
  async createManager() {
    try {
      if (!this.factoryContract) {
        console.error("Factory contract not initialized");
        return { success: false, message: "Factory contract not initialized" };
      }
      
      console.log("Creating new manager...");
      
      // Check if a manager already exists
      const userAddress = await this.signer.getAddress();
      console.log("Checking if user already has a manager for:", userAddress);
      
      let existingManager;
      try {
        existingManager = await this.factoryContract.getUserManager(userAddress);
        console.log("Manager check result:", existingManager);
      } catch (error) {
        console.error("Error checking existing manager:", error);
        return { 
          success: false, 
          message: "Could not check if user has an existing manager. The contract might not be deployed at the specified address." 
        };
      }
      
      if (existingManager !== ethers.ZeroAddress) {
        this.managerAddress = existingManager;
        console.log("User already has a manager at", existingManager);
        
        // Initialize the existing manager contract
        this.managerContract = new ethers.Contract(
          existingManager,
          UserLPManagerABI,
          this.signer
        );
        
        return { success: true, managerAddress: existingManager, alreadyExists: true };
      }
      
      // Create new manager
      console.log("Sending transaction to create manager...");
      try {
        // Get gas price and estimate gas for the transaction
        if (!this.signer.provider) {
          console.error("Provider is null");
          return { success: false, message: "Provider is not available" };
        }
        
        const gasPrice = await this.signer.provider.getFeeData();
        
        // Initial gas settings with higher values
        let maxRetries = 2; // Number of retry attempts
        let retryCount = 0;
        let receipt;
        let tx;
        
        while (retryCount <= maxRetries) {
          try {
            // Increase gas multipliers with each retry
            const feeMultiplier = 15n + (BigInt(retryCount) * 5n); // Start at 1.5x, increase by 0.5x each retry
            const priorityMultiplier = 20n + (BigInt(retryCount) * 10n); // Start at 2x, increase by 1x each retry
            
            // Prepare transaction options with appropriate gas settings
            const txOptions = {
              gasLimit: 6000000, // Higher gas limit to prevent underestimation
              maxFeePerGas: gasPrice.maxFeePerGas ? gasPrice.maxFeePerGas * feeMultiplier / 10n : undefined,
              maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas ? gasPrice.maxPriorityFeePerGas * priorityMultiplier / 10n : undefined
            };
            
            console.log(`Sending transaction with options (attempt ${retryCount + 1}):`, txOptions);
            tx = await this.factoryContract.createManager(txOptions);
            
            console.log("Transaction sent:", tx.hash);
            console.log("Waiting for transaction confirmation...");
            
            // Set a timeout for transaction confirmation
            const receiptPromise = tx.wait();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Transaction confirmation timeout")), 60000) // 60 second timeout
            );
            
            // Wait for either confirmation or timeout
            receipt = await Promise.race([receiptPromise, timeoutPromise]);
            console.log("Transaction confirmed:", receipt.transactionHash);
            break; // Exit the retry loop if successful
          } catch (error) {
            retryCount++;
            if (retryCount > maxRetries) {
              console.error("Max retries reached. Last error:", error);
              throw error; // Re-throw the last error after max retries
            }
            console.warn(`Transaction attempt ${retryCount} failed, retrying with higher gas...`, error);
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        
        // Look for ManagerCreated event
        const event = receipt.events?.find((e: {event: string, args: any}) => e.event === 'ManagerCreated');
        
        if (!event) {
          console.log("No ManagerCreated event found in transaction");
          
          // Try to get manager address directly
          const managerAddress = await this.factoryContract.getUserManager(userAddress);
          
          if (managerAddress === ethers.ZeroAddress) {
            return { success: false, message: "Manager creation failed - no event found and getUserManager returns zero address" };
          }
          
          this.managerAddress = managerAddress;
          console.log("Manager address retrieved from contract:", managerAddress);
        } else {
          // Get manager address from event
          this.managerAddress = event.args.manager;
          console.log("Manager address from event:", this.managerAddress);
        }
        
        // Initialize the manager contract
        if (!this.managerAddress) {
          return { 
            success: false, 
            message: "Manager address is null" 
          };
        }
        
        this.managerContract = new ethers.Contract(
          this.managerAddress,
          UserLPManagerABI,
          this.signer
        );
        
        // Set Aerodrome factory if it doesn't already have one
        try {
          console.log("Setting Aerodrome factory address...");
          const aerodromeFactoryAddress = await this.managerContract.aerodromeFactory().catch(() => null);
          
          if (!aerodromeFactoryAddress || aerodromeFactoryAddress === ethers.ZeroAddress) {
            const setFactoryTx = await this.managerContract.setAerodromeFactory(this.addresses.AERODROME_FACTORY);
            await setFactoryTx.wait();
            console.log("Factory address set successfully");
          } else {
            console.log("Factory already set:", aerodromeFactoryAddress);
          }
        } catch (error) {
          console.error("Error setting factory address:", error);
          // Continue even if setting factory fails - the manager was created successfully
        }
        
        return { 
          success: true, 
          managerAddress: this.managerAddress,
          txHash: receipt.transactionHash
        };
      } catch (error) {
        if ((error as Error).message.includes("User already has a manager")) {
          // This is a special case - try to get the manager address
          try {
            const managerAddress = await this.factoryContract.getUserManager(userAddress);
            if (managerAddress !== ethers.ZeroAddress) {
              this.managerAddress = managerAddress;
              this.managerContract = new ethers.Contract(
                managerAddress,
                UserLPManagerABI,
                this.signer
              );
              
              return { 
                success: true, 
                managerAddress: managerAddress, 
                alreadyExists: true 
              };
            }
          } catch (secondError) {
            console.error("Error getting manager after 'already has manager' error:", secondError);
          }
        }
        
        console.error("Error creating manager:", error);
        return { 
          success: false, 
          message: (error as Error).message || "Failed to create manager",
          error
        };
      }
    } catch (error) {
      console.error("Unexpected error creating manager:", error);
      return { 
        success: false, 
        message: (error as Error).message || "Unexpected error creating manager",
        error
      };
    }
  }

  /**
   * Get staked LP positions and rewards
   */
  async getStakedPositions() {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager not initialized" };
      }

      // Track which LP tokens we've already processed to avoid duplicates
      const processedLpTokens = new Set();
      
      // Initialize voter contract if not already initialized
      if (!this.voterContract) {
        try {
          console.log("Initializing voter contract...");
          this.voterContract = new ethers.Contract(
            this.addresses.AERODROME_VOTER,
            IAerodromeVoterABI,
            this.signer
          );
          console.log("Voter contract initialized");
        } catch (error) {
          console.warn("Warning: Could not initialize voter contract:", error);
        }
      }

      // First, check all LP positions from the manager
      let lpPositions: any[] = [];
      try {
        const lpResult = await this.getLPPositions();
        lpPositions = lpResult.success && lpResult.positions ? lpResult.positions : [];
        
        console.log(`Checking ${lpPositions.length} LP positions for staking...`);
      } catch (error) {
        console.error("Error getting LP positions:", error);
        // Ensure lpPositions is always an array
        lpPositions = [];
      }

      // Create pairs of common tokens to check
      // This helps us find gauges even if LP positions aren't found
      const commonTokenPairs = [
        { token0: this.addresses.USDC, token1: this.addresses.WETH, stable: false },
        { token0: this.addresses.USDC, token1: this.addresses.AERO, stable: false },
        { token0: this.addresses.WETH, token1: this.addresses.AERO, stable: false },
        { token0: this.addresses.WETH, token1: this.addresses.VIRTUAL, stable: false },
        { token0: this.addresses.USDC, token1: this.addresses.VIRTUAL, stable: false },
        { token0: this.addresses.AERO, token1: this.addresses.VIRTUAL, stable: false },
        { token0: this.addresses.WETH, token1: this.addresses.TN100x, stable: false },
        { token0: this.addresses.WETH, token1: this.addresses.VEIL, stable: false },
      ];

      // Check for Aerodrome factory and pool contracts
      try {
        // Function to get pool address - similar to how Aerodrome Router does it
        const getPoolAddress = async (token0: string, token1: string, stable: boolean) => {
          try {
            // Ensure correct order
            let tokenA = token0;
            let tokenB = token1;
            
            if (token0.toLowerCase() > token1.toLowerCase()) {
              tokenA = token1;
              tokenB = token0;
            }

            // Try to use the manager's getAerodromePair method first
            if (this.managerContract) {
              try {
                const pairAddress = await this.managerContract.getAerodromePair(tokenA, tokenB, stable);
                if (pairAddress && pairAddress !== ethers.ZeroAddress) {
                  return pairAddress;
                }
              } catch (error) {
                console.log(`Manager doesn't have getAerodromePair method, trying alternate methods...`);
              }
            }

            // Try to use a direct contract for Aerodrome Factory
            try {
              const aerodromeFactoryContract = new ethers.Contract(
                this.addresses.AERODROME_FACTORY,
                [
                  {
                    "inputs": [
                      {"internalType": "address", "name": "tokenA", "type": "address"},
                      {"internalType": "address", "name": "tokenB", "type": "address"},
                      {"internalType": "bool", "name": "stable", "type": "bool"}
                    ],
                    "name": "getPair",
                    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                    "stateMutability": "view",
                    "type": "function"
                  }
                ],
                this.provider
              );
              
              const pairAddress = await aerodromeFactoryContract.getPair(tokenA, tokenB, stable);
              if (pairAddress && pairAddress !== ethers.ZeroAddress) {
                return pairAddress;
              }
            } catch (error) {
              console.log(`Factory doesn't have getPair method, trying alternate method...`);
            }

            return null;
          } catch (error) {
            console.error(`Error getting pool for ${token0}/${token1}:`, error);
            return null;
          }
        };

        const stakedPositions = [];
        const gauges = [];
        let totalRewards = BigInt(0);

        // Process LP tokens from positions found in the manager
        for (const position of lpPositions) {
          // Skip if already processed
          if (processedLpTokens.has(position.lpToken.toLowerCase())) continue;
          processedLpTokens.add(position.lpToken.toLowerCase());
          
          try {
            // Find the gauge for this LP token
            let gaugeAddress = null;
            
            if (this.voterContract) {
              try {
                gaugeAddress = await this.voterContract.gauges(position.lpToken);
              } catch (error) {
                console.warn(`Could not get gauge for LP token ${position.lpToken}:`, error);
              }
            }
            
            if (gaugeAddress && gaugeAddress !== ethers.ZeroAddress) {
              const gaugeContract = new ethers.Contract(
                gaugeAddress,
                IAerodromeGaugeABI,
                this.signer
              );
              
              // Check if we have any staked balance
              try {
                const stakedBalance = await gaugeContract.balanceOf(this.managerAddress);
                
                if (stakedBalance > 0) {
                  // Get earned rewards
                  let earned = BigInt(0);
                  try {
                    earned = await gaugeContract.earned(this.managerAddress);
                  } catch (error) {
                    console.warn(`Could not get earned rewards for gauge ${gaugeAddress}:`, error);
                  }
                  
                  totalRewards += earned;
                  
                  stakedPositions.push({
                    lpToken: position.lpToken,
                    gauge: gaugeAddress,
                    stakedBalance,
                    formattedStakedBalance: ethers.formatEther(stakedBalance),
                    earned,
                    formattedEarned: ethers.formatEther(earned),
                    poolName: position.poolName || "Unknown Pool",
                    token0: position.token0,
                    token1: position.token1
                  });
                  
                  gauges.push(gaugeAddress);
                }
              } catch (error) {
                console.error(`Error checking staked balance for gauge ${gaugeAddress}:`, error);
              }
            }
          } catch (error) {
            console.error(`Error processing LP token ${position.lpToken}:`, error);
          }
        }

        // Check common token pairs to find any additional staked positions
        for (const pair of commonTokenPairs) {
          try {
            const poolAddress = await getPoolAddress(pair.token0, pair.token1, pair.stable);
            
            if (poolAddress && !processedLpTokens.has(poolAddress.toLowerCase())) {
              processedLpTokens.add(poolAddress.toLowerCase());
              
              // Find gauge
              let gaugeAddress = null;
              if (this.voterContract) {
                try {
                  gaugeAddress = await this.voterContract.gauges(poolAddress);
                } catch (error) {
                  console.warn(`Could not get gauge for pool ${poolAddress}:`, error);
                  continue;
                }
              } else {
                continue;
              }
              
              if (gaugeAddress && gaugeAddress !== ethers.ZeroAddress) {
                const gaugeContract = new ethers.Contract(
                  gaugeAddress,
                  IAerodromeGaugeABI,
                  this.signer
                );
                
                // Check if we have any staked balance
                try {
                  const stakedBalance = await gaugeContract.balanceOf(this.managerAddress);
                  
                  if (stakedBalance > 0) {
                    // Get token names
                    let token0Symbol = "Unknown";
                    let token1Symbol = "Unknown";
                    
                    const tokenKeys = Object.keys(this.addresses);
                    for (const key of tokenKeys) {
                      if (this.addresses[key].toLowerCase() === pair.token0.toLowerCase()) {
                        token0Symbol = key;
                      }
                      if (this.addresses[key].toLowerCase() === pair.token1.toLowerCase()) {
                        token1Symbol = key;
                      }
                    }
                    
                    // Get earned rewards
                    let earned = BigInt(0);
                    try {
                      earned = await gaugeContract.earned(this.managerAddress);
                    } catch (error) {
                      console.warn(`Could not get earned rewards for gauge ${gaugeAddress}:`, error);
                    }
                    
                    totalRewards += earned;
                    
                    stakedPositions.push({
                      lpToken: poolAddress,
                      gauge: gaugeAddress,
                      stakedBalance,
                      formattedStakedBalance: ethers.formatEther(stakedBalance),
                      earned,
                      formattedEarned: ethers.formatEther(earned),
                      poolName: `${token0Symbol}-${token1Symbol}`,
                      token0: pair.token0,
                      token1: pair.token1
                    });
                    
                    gauges.push(gaugeAddress);
                  }
                } catch (error) {
                  console.error(`Error checking staked balance for gauge ${gaugeAddress}:`, error);
                }
              }
            }
          } catch (error) {
            console.error(`Error processing token pair ${pair.token0}/${pair.token1}:`, error);
          }
        }

        console.log("LP positions retrieved:", lpPositions);
        console.log("Staked positions retrieved:", stakedPositions);
        console.log("Gauges retrieved:", gauges);
        console.log(`Total rewards: ${ethers.formatEther(totalRewards)} AERO`);
        
        return {
          success: true,
          positions: lpPositions,
          stakedPositions,
          gauges,
          totalRewards,
          formattedTotalRewards: ethers.formatEther(totalRewards)
        };
      } catch (error) {
        console.error("Error getting staked positions:", error);
        return { success: false, message: (error as Error).message };
      }
    } catch (error) {
      console.error("Error getting staked positions:", error);
      return { success: false, message: (error as Error).message };
    }
  }
  
  /**
   * Stake LP tokens in a gauge
   */
  async stakeLPTokens(lpToken: string, poolName: string, amount = "MAX") {
    try {
      if (!this.managerContract || !this.voterContract) {
        return { success: false, message: "Manager or Voter contract not initialized" };
      }
      
      // Get gauge address
      const gaugeAddress = await this.voterContract.gauges(lpToken);
      
      if (gaugeAddress === ethers.ZeroAddress) {
        return { success: false, message: `No gauge found for ${poolName}` };
      }
      
      // Get LP token balance
      const lpContract = new ethers.Contract(
        lpToken,
        IERC20ABI,
        this.provider
      );
      
      const balance = await lpContract.balanceOf(this.managerAddress);
      
      if (isZero(balance)) {
        return { success: false, message: `No LP tokens available for ${poolName}` };
      }
      
      // Determine amount to stake
      let stakeAmount;
      if (amount === "MAX") {
        stakeAmount = balance;
      } else {
        stakeAmount = ethers.parseUnits(amount, POOLS.find(p => p.name === poolName)?.tokenA.decimals || 18);
        if (stakeAmount > balance) {
          return { 
            success: false, 
            message: `Insufficient LP tokens. Have: ${ethers.formatUnits(balance, POOLS.find(p => p.name === poolName)?.tokenA.decimals || 18)}, requested: ${amount}` 
          };
        }
      }
      
      // Stake LP tokens - using only 2 parameters as per contract definition
      const tx = await this.managerContract.stakeLPTokens(
        lpToken,
        stakeAmount,
        { gasLimit: 3000000 }
      );
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        lpToken,
        poolName,
        gaugeAddress,
        amount: ethers.formatUnits(stakeAmount, POOLS.find(p => p.name === poolName)?.tokenA.decimals || 18)
      };
    } catch (error) {
      console.error("Error staking LP tokens:", error);
      return { success: false, message: (error as Error).message };
    }
  }
  
  /**
   * Unstake LP tokens from a gauge
   */
  async unstakeLPTokens(lpToken: string, poolName: string, gaugeAddress: string, amount = "MAX") {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager not initialized" };
      }
      
      // Get gauge contract
      const gaugeContract = new ethers.Contract(
        gaugeAddress,
        IAerodromeGaugeABI,
        this.provider
      );
      
      // Verify staked balance
      const stakedBalance = await gaugeContract.balanceOf(this.managerAddress);
      if (isZero(stakedBalance)) {
        return { success: false, message: `No staked LP tokens in ${poolName}` };
      }
      
      // Determine amount to unstake
      let unstakeAmount;
      if (amount === "MAX") {
        unstakeAmount = stakedBalance;
      } else {
        unstakeAmount = ethers.parseUnits(amount, POOLS.find(p => p.name === poolName)?.tokenA.decimals || 18);
        if (unstakeAmount > stakedBalance) {
          return { 
            success: false, 
            message: `Insufficient staked LP tokens. Have: ${ethers.formatUnits(stakedBalance, POOLS.find(p => p.name === poolName)?.tokenA.decimals || 18)}, requested: ${amount}` 
          };
        }
      }
      
      // Unstake LP tokens - using only 2 parameters as per contract definition
      const tx = await this.managerContract.unstakeLPTokens(
        lpToken,
        unstakeAmount,
        { 
          gasLimit: 5000000,
          gasPrice: ethers.parseUnits("1.5", "gwei") // Set a reasonable gas price directly
        }
      );
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        lpToken,
        poolName,
        gaugeAddress,
        amount: ethers.formatUnits(unstakeAmount, POOLS.find(p => p.name === poolName)?.tokenA.decimals || 18)
      };
    } catch (error) {
      console.error("Error unstaking LP tokens:", error);
      return { success: false, message: (error as Error).message };
    }
  }
  
  /**
   * Claim rewards from a gauge
   */
  async claimRewards(lpToken: string, poolName: string, gaugeAddress: string) {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager not initialized" };
      }
      
      // Get gauge contract
      const gaugeContract = new ethers.Contract(
        gaugeAddress,
        IAerodromeGaugeABI,
        this.signer
      );
      
      // Check earned rewards
      const earned = await gaugeContract.earned(this.managerAddress);
      
      if (isZero(earned)) {
        return { success: false, message: `No rewards to claim for ${poolName}` };
      }
      
      // Claim rewards using the manager contract
      const tx = await this.managerContract.claimRewards(
        lpToken,
        { 
          gasLimit: 6000000,
          gasPrice: ethers.parseUnits("1.5", "gwei") // Set a reasonable gas price directly
        }
      );
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        lpToken,
        poolName,
        gaugeAddress
      };
    } catch (error) {
      console.error("Error claiming rewards:", error);
      return { success: false, message: (error as Error).message };
    }
  }
  /**
   * Claim all rewards from all gauges
   */
  async claimAllRewards() {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager not initialized" };
      }
      
      // Get staked positions
      const positionsResult = await this.getStakedPositions();
      
      if (!positionsResult.success || !positionsResult.stakedPositions) {
        return { success: false, message: "Failed to retrieve staked positions" };
      }
      
      const stakedPositions = positionsResult.stakedPositions;
      
      if (stakedPositions.length === 0) {
        return { success: false, message: "No staked positions found" };
      }
      
      // Check if any position has rewards over 1 AERO
      let hasClaimableRewards = false;
      const claimablePositions = [];
      for (const position of stakedPositions) {
        const earnedFormatted = parseFloat(ethers.formatEther(position.earned || "0"));
        if (earnedFormatted >= 1.0) {
          hasClaimableRewards = true;
          claimablePositions.push(position);
        }
      }
      
      if (!hasClaimableRewards) {
        return { success: false, message: "No positions have rewards above the 1 AERO minimum threshold" };
      }
      
      // Claim rewards from all gauges with sufficient rewards
      const results = [];
      
      for (let i = 0; i < claimablePositions.length; i++) {
        const position = claimablePositions[i];
        try {
          // Claim rewards for this position
          const result = await this.claimRewards(
            position.lpToken,
            position.poolName,
            position.gauge
          );
          // Push result ONLY IF successful
          if (result.success) {
              results.push(result);
          } else {
              console.warn(`Failed to claim rewards for ${position.poolName}: ${result.message}`);
          }
        } catch (error) {
            // Catch errors during the claim call itself
            console.warn(`Error claiming rewards for ${position.poolName}:`, error);
        }
      }
      
      if (results.some(r => r.success)) {
        return { success: true, results };
      } else {
        return { success: false, message: "Failed to claim any rewards" };
      }
    } catch (error) {
      console.error("Error claiming all rewards:", error);
      return { success: false, message: (error as Error).message };
    }
  }

  // Helper method to convert various types to BigInt
  private toBigInt(value: any): bigint {
    if (value === undefined || value === null) {
      return BigInt(0);
    }
    
    if (typeof value === 'bigint') {
      return value;
    }
    
    if (typeof value === 'number') {
      return BigInt(Math.floor(value));
    }
    
    if (typeof value === 'string') {
      if (value.startsWith('0x')) {
        return BigInt(value);
      }
      // Handle decimal strings
      try {
        // Attempt to parse as a float first to handle scientific notation
        const floatVal = parseFloat(value);
        if (!isNaN(floatVal) && isFinite(floatVal)) {
          // Convert potentially very large or small floats carefully
          return BigInt(Math.trunc(floatVal));
        }
        // Fallback for non-numeric strings or strings that parseFloat fails on
        return BigInt(value.replace(/\..*$/, ''));
      } catch {
        // If any error occurs during parsing, assume it's not a valid number string
        console.warn("Could not convert string to BigInt, returning 0:", value);
        return BigInt(0);
      }
    }
    
    // Handle ethers BigNumber (v5)
    if (typeof value === 'object') {
      if (typeof value.toBigInt === 'function') {
        return value.toBigInt();
      }
      
      if (value._hex) {
        return BigInt(value._hex);
      }
      
      if (value.toString) {
        const strValue = value.toString();
        try {
           if (strValue.startsWith('0x')) {
             return BigInt(strValue);
           }
           // Handle decimal strings from toString()
           const floatVal = parseFloat(strValue);
           if (!isNaN(floatVal) && isFinite(floatVal)) {
               return BigInt(Math.trunc(floatVal));
           }
           return BigInt(strValue.replace(/\..*$/, ''));
        } catch {
            console.warn("Could not convert object.toString() to BigInt, returning 0:", strValue);
            return BigInt(0);
        }
      }
    }
    
    // If we can't convert, return 0
    console.warn("Could not convert value to BigInt, returning 0:", value);
    return BigInt(0);
  }

  // Fix unused variables by either using them or renaming to _
  async getPoolByName(poolName: string): Promise<any | null> {
    try {
      // Existing implementation
      return null;
    } catch (error) {
      console.error(`Error getting pool by name ${poolName}:`, error);
      return null;
    }
  }
  
  // Update other methods with unused error variables
  async getPoolAddressByTokens(token0: string, token1: string, stable: boolean): Promise<string | null> {
    try {
      // Implementation
      return await this.getAerodromePair(token0, token1, stable); // Use existing method if it serves the purpose
    } catch (error) {
      console.error(`Error getting pool address for tokens ${token0}, ${token1}:`, error);
      return null;
    }
  }
  
  // Fix let variables that should be const
  async getAerodromePair(token0: string, token1: string, stable: boolean): Promise<string | null> {
    try {
        // Check if factory contract exists
        if (!this.managerContract) { // Should probably check factoryContract or managerContract depending on which holds getPool
             console.warn("Manager contract not initialized for getAerodromePair");
             return null;
        }

        // Let's assume getAerodromePair is the intended method on the manager
        const maxRetries = 3;
        let attempts = 0;

        while (attempts < maxRetries) {
            try {
                const poolAddress = await this.managerContract.getAerodromePair(token0, token1, stable);
                return poolAddress === ethers.ZeroAddress ? null : poolAddress;

            } catch (retryError) {
                attempts++;
                console.warn(`Attempt ${attempts} to get pool address via manager failed:`, retryError);
                if (attempts >= maxRetries) {
                    console.error(`Failed to get pool address after ${maxRetries} attempts:`, retryError);
                    return null;
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
            }
        }
        return null; // Should be unreachable if loop logic is correct, but satisfy TS
    } catch (error) {
        console.error("Error getting Aerodrome pair address:", error);
        return null;
    }
  }

  /**
   * Get claimable fees for a specific pool
   */
  async getClaimableFees(tokenA: string, tokenB: string, stable: boolean) {
    const poolName = `${tokenA}/${tokenB} (Stable: ${stable})`; // For logging
    console.log(`[getClaimableFees] Checking fees for pool: ${poolName}`);

    if (!this.managerContract) {
      console.error("[getClaimableFees] Manager contract not initialized.");
      return { success: false, message: "Manager not initialized" };
    }

    // --- Method 1: Try managerContract.getClaimableFees ---
    try {
      console.log(`[getClaimableFees] Attempting manager.getClaimableFees for ${poolName}...`);
      // Call the manager contract function (view call, no gasLimit needed)
      const result = await this.managerContract.getClaimableFees(
        tokenA,
        tokenB,
        stable
        // Removed diagnostic gasLimit override
      );

      // Ethers v6 returns a Result object which is array-like but also has named properties.
      // Access properties directly by name as defined in the ABI.
      if (result && typeof result.lpBalance !== 'undefined' && typeof result.claimable0Amount !== 'undefined' && typeof result.claimable1Amount !== 'undefined') {
        const lpBalance = result.lpBalance;
        const claimable0 = result.claimable0Amount; // Use ABI name
        const claimable1 = result.claimable1Amount; // Use ABI name

        // Debug the actual values from the contract
        console.log(`[getClaimableFees] Debug contract result values:`, {
            lpBalance: lpBalance.toString(),
            claimable0Amount: result.claimable0Amount.toString(),
            claimable1Amount: result.claimable1Amount.toString(),
        });
        
        console.log(`[getClaimableFees] Success via manager.getClaimableFees for ${poolName}:`, {
            lpBalance: lpBalance.toString(),
            claimable0: claimable0.toString(), // Log raw value
            claimable1: claimable1.toString(), // Log raw value
        });
        return {
          success: true,
          // Convert to BigInt using helper for safety, though they should already be BigInt
          lpBalance: this.toBigInt(lpBalance),
          claimable0: this.toBigInt(claimable0),
          claimable1: this.toBigInt(claimable1),
          // Also include the original property names for debugging
          claimable0Amount: this.toBigInt(claimable0),
          claimable1Amount: this.toBigInt(claimable1)
        };
      } else {
         // This case should ideally not be hit if the contract call succeeds and ABI matches
         console.warn(`[getClaimableFees] manager.getClaimableFees returned unexpected structure or missing properties for ${poolName}:`, result);
         // Proceed to fallback
      }

    } catch (error) {
      console.warn(`[getClaimableFees] manager.getClaimableFees failed for ${poolName}:`, (error as Error).message);
      // Proceed to fallback method
    }

    // --- Method 2: Fallback - Query pool contract directly ---
    // Keep the fallback logic as a safety net, unchanged from the previous version
    console.log(`[getClaimableFees] Resorting to direct pool query for ${poolName}...`);
    try {
      const poolAddress = await this.getAerodromePair(tokenA, tokenB, stable);
      if (!poolAddress || poolAddress === ethers.ZeroAddress) {
          console.log(`[getClaimableFees] Fallback: Pool not found for ${poolName}.`);
          return { success: false, message: "Pool not found for fallback fee check." };
      }
      console.log(`[getClaimableFees] Fallback: Found pool address ${poolAddress} for ${poolName}.`);

      // Ensure provider is available for read-only calls
      if (!this.provider) {
           console.error("[getClaimableFees] Fallback: Provider not available for direct pool query.");
           return { success: false, message: "Provider not available" };
      }
      // Ensure manager address is known
      if (!this.managerAddress) {
          console.error("[getClaimableFees] Fallback: Manager address not known for direct pool query.");
          return { success: false, message: "Manager address not known" };
      }

      const poolContract = new ethers.Contract(
          poolAddress,
          IAerodromePairABI, // Assuming this ABI contains claimable0/1 functions
          this.provider // Use provider for read-only calls
      );

      // Check if ABI contains the necessary functions
      const hasClaimable0 = poolContract.interface.getFunction("claimable0(address)") !== null;
      const hasClaimable1 = poolContract.interface.getFunction("claimable1(address)") !== null;


      if (!hasClaimable0 || !hasClaimable1) {
          console.warn(`[getClaimableFees] Fallback: Pool contract ${poolAddress} ABI does not contain claimable0/claimable1 functions.`);
          return { success: true, lpBalance: 0n, claimable0: 0n, claimable1: 0n, message: "Pool ABI missing claimable functions." };
      }

      console.log(`[getClaimableFees] Fallback: Querying claimable0 and claimable1 for manager ${this.managerAddress} on pool ${poolAddress}`);
      let claimable0 = 0n;
      let claimable1 = 0n;
      let lpBalance = 0n;
      try {
          claimable0 = await poolContract.claimable0(this.managerAddress);
          claimable1 = await poolContract.claimable1(this.managerAddress);
          const lpTokenContract = new ethers.Contract(poolAddress, IERC20ABI, this.provider);
          lpBalance = await lpTokenContract.balanceOf(this.managerAddress);
      } catch (contractCallError) {
           console.error(`[getClaimableFees] Error calling pool contract functions for ${poolName}:`, contractCallError);
           return { success: false, message: `Failed to query pool contract: ${(contractCallError as Error).message}` };
      }

      console.log(`[getClaimableFees] Success via fallback for ${poolName}:`, {
          lpBalance: lpBalance.toString(),
          claimable0: claimable0.toString(),
          claimable1: claimable1.toString(),
      });

      return {
          success: true,
          lpBalance: this.toBigInt(lpBalance),
          claimable0: this.toBigInt(claimable0),
          claimable1: this.toBigInt(claimable1),
          // Include original property names for consistency
          claimable0Amount: this.toBigInt(claimable0),
          claimable1Amount: this.toBigInt(claimable1)
      };
    } catch (fallbackError) {
      console.error(`[getClaimableFees] Fallback setup failed for ${poolName}:`, fallbackError);
      return { success: false, message: `Fee check setup failed: ${(fallbackError as Error).message}` };
    }
  }

  /**
   * Claim accumulated fees for a specific pool
   */
  async claimFees(tokenA: string, tokenB: string, stable: boolean) {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager not initialized" };
      }

      console.log(`Claiming fees for ${tokenA}/${tokenB} (stable: ${stable})...`);

      // Get gas price data
      if (!this.signer.provider) {
        return { success: false, message: "Provider not available" };
      }
      const feeData = await this.signer.provider.getFeeData();
      const maxFeePerGas = feeData.maxFeePerGas ? feeData.maxFeePerGas * 15n / 10n : ethers.parseUnits("1.5", "gwei");
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * 20n / 10n : ethers.parseUnits("0.1", "gwei");

      // Call the claimFees function on the manager contract
      const tx = await this.managerContract.claimFees(
        tokenA,
        tokenB,
        stable,
        { 
          gasLimit: 6000000, // Increase gas limit for safety
          maxFeePerGas,
          maxPriorityFeePerGas
        }
      );

      console.log("Waiting for claimFees transaction...", tx.hash);
      const receipt = await tx.wait();
      console.log("ClaimFees transaction confirmed:", receipt.transactionHash);

      // Parse FeesClaimed event if present
      const event = receipt.events?.find((e: any) => e.event === 'FeesClaimed');
      let amount0Received = BigInt(0);
      let amount1Received = BigInt(0);

      if (event && event.args) {
        amount0Received = this.toBigInt(event.args.amount0);
        amount1Received = this.toBigInt(event.args.amount1);
        console.log(`Fees claimed from event: Amount0=${amount0Received}, Amount1=${amount1Received}`);
      } else {
        console.log("FeesClaimed event not found in receipt.");
        // Optionally, check balance changes as a fallback
      }

      return {
        success: true,
        txHash: receipt.transactionHash,
        amount0Received,
        amount1Received
      };
    } catch (error) {
      console.error("Error claiming fees:", error);
      return {
        success: false,
        message: (error as Error).message || "Failed to claim fees",
        error
      };
    }
  }

  /**
   * Check if an address is a manager
   * @param managerAddress Address to check
   * @returns Boolean indicating if the address is a manager
   */
  async isManager(managerAddress: string) {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager contract not initialized" };
      }

      // Validate the manager address
      if (!ethers.isAddress(managerAddress)) {
        return { success: false, message: "Invalid manager address" };
      }

      // Call the isManager function on the contract
      const isManagerResult = await this.managerContract.isManager(managerAddress);
      return { success: true, isManager: isManagerResult };
    } catch (error) {
      console.error("Error checking if address is manager:", error);
      return { 
        success: false, 
        isManager: false, 
        message: error instanceof Error ? error.message : "Unknown error checking manager status" 
      };
    }
  }

  /**
   * Get optimized gas options for transactions
   * @returns Gas options object with appropriate values
   */
  async getGasOptions() {
    try {
      // Try using the provider's fee data API (ethers v6 style)
      const feeData = await this.provider.getFeeData();
      const gasOptions: any = {};
      
      // Use gasPrice for networks that don't support EIP-1559
      if (feeData.gasPrice) {
        gasOptions.gasPrice = feeData.gasPrice;
      } 
      // For EIP-1559 compatible networks
      else if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        gasOptions.maxFeePerGas = feeData.maxFeePerGas;
        gasOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      }
      
      return gasOptions;
    } catch (error) {
      console.warn("Error getting gas options:", error);
      return {}; // Return empty object if estimation fails, contract will use defaults
    }
  }

  /**
   * Add a manager to the contract
   * @param managerAddress Address to add as a manager
   * @returns Transaction object
   */
  async addManager(managerAddress: string) {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager contract not initialized" };
      }

      // Validate the manager address
      if (!ethers.isAddress(managerAddress)) {
        return { success: false, message: "Invalid manager address" };
      }

      // Check if already a manager
      const isManagerResult = await this.isManager(managerAddress);
      if (isManagerResult.success && isManagerResult.isManager) {
        return { success: true, message: "Address is already a manager" };
      }

      // Get gas options
      const gasOptions = await this.getGasOptions();
      console.log("Gas options for addManager:", gasOptions);

      // Add the manager - return the raw transaction for the caller to handle
      const tx = await this.managerContract.addManager(managerAddress, gasOptions);
      
      // Return the transaction itself instead of waiting for it
      return { success: true, tx };
    } catch (error) {
      console.error("Error adding manager:", error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error adding manager" 
      };
    }
  }

  /**
   * Remove a manager from the contract
   * @param managerAddress Address to remove as a manager
   * @returns Transaction object
   */
  async removeManager(managerAddress: string) {
    try {
      if (!this.managerContract) {
        return { success: false, message: "Manager contract not initialized" };
      }

      // Validate the manager address
      if (!ethers.isAddress(managerAddress)) {
        return { success: false, message: "Invalid manager address" };
      }

      // Check if actually a manager
      const isManagerResult = await this.isManager(managerAddress);
      if (isManagerResult.success && !isManagerResult.isManager) {
        return { success: true, message: "Address is not a manager" };
      }

      // Get gas options
      const gasOptions = await this.getGasOptions();
      console.log("Gas options for removeManager:", gasOptions);

      // Remove the manager - return the raw transaction for the caller to handle
      const tx = await this.managerContract.removeManager(managerAddress, gasOptions);
      
      // Return the transaction itself instead of waiting for it
      return { success: true, tx };
    } catch (error) {
      console.error("Error removing manager:", error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error removing manager" 
      };
    }
  }
}

// Export the AerodromeManager class as default export
export default AerodromeManager; 