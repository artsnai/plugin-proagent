import type { Plugin } from '@elizaos/core';
import {
  type Action,
  type Content,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
} from '@elizaos/core';
import { z } from 'zod';
import { getManagerAddress, getTokenBalances, getStakedPositions, addLiquidityAndStake, depositTokens, AddLiquidityAndStakeResult, unstakeAndRemoveLiquidity, UnstakeAndRemoveLiquidityResult, withdrawTokens, WithdrawTokensResult, claimPoolRewards, claimAllPoolRewards, ClaimRewardsResult, claimPoolFees, ClaimFeesResult, getPoolClaimableFees, getAllClaimableFees, ClaimableFeesResult, createNewManager, CreateManagerResult } from './aerodromeUtils';

/**
 * Defines the configuration schema for a plugin, including the validation rules for the plugin name.
 *
 * @type {import('zod').ZodObject<{ EXAMPLE_PLUGIN_VARIABLE: import('zod').ZodString }>}
 */
const configSchema = z.object({
  EVM_PRIVATE_KEY: z
    .string()
    .min(1, 'EVM private key is not provided')
    .transform((val) => {
      if (!val) {
        logger.warn('EVM private key is not provided');
      }
      return val;
    }),
  EVM_PROVIDER_URL: z
    .string()
    .min(1, 'EVM provider URL is not provided')
    .transform((val) => {
      if (!val) {
        logger.warn('EVM provider URL is not provided');
      }
      return val;
    }),
});

/**
 * Example HelloWorld action
 * This demonstrates the simplest possible action structure
 */
/**
 * Action representing a hello world message.
 * @typedef {Object} Action
 * @property {string} name - The name of the action.
 * @property {string[]} similes - An array of related actions.
 * @property {string} description - A brief description of the action.
 * @property {Function} validate - Asynchronous function to validate the action.
 * @property {Function} handler - Asynchronous function to handle the action and generate a response.
 * @property {Object[]} examples - An array of example inputs and expected outputs for the action.
 */
const helloWorldAction: Action = {
  name: 'HELLO_WORLD',
  similes: ['GREET', 'SAY_HELLO'],
  description: 'Responds with a simple hello world message',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<boolean> => {
    // Always valid
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling HELLO_WORLD action');

      // Simple response content
      const responseContent: Content = {
        text: 'hello world!',
        actions: ['HELLO_WORLD'],
        source: message.content.source,
      };

      // Call back with the hello world message
      await callback(responseContent);

      return responseContent;
    } catch (error) {
      logger.error('Error in HELLO_WORLD action:', error);
      throw error;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Can you say hello?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'hello world!',
          actions: ['HELLO_WORLD'],
        },
      },
    ],
  ],
};

/**
 * Example Hello World Provider
 * This demonstrates the simplest possible provider implementation
 */
const helloWorldProvider: Provider = {
  name: 'HELLO_WORLD_PROVIDER',
  description: 'A simple example provider',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    return {
      text: 'I am a provider',
      values: {},
      data: {},
    };
  },
};

/**
 * Balances action
 * Returns token balances from a smart contract
 */
const balancesAction: Action = {
  name: 'BALANCES',
  similes: ['GET_BALANCES', 'TOKEN_BALANCES', 'CHECK_BALANCES'],
  description: 'Returns token balances from a smart contract',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<boolean> => {
    // Always valid for now, will add validation later
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling BALANCES action');

      // Fetch token balances using our utility
      const balances = await getTokenBalances();
      
      let responseText = '';
      
      if (balances) {
        // Format balances into a readable string
        responseText = 'Here are your token balances:\n';
        
        for (const symbol in balances) {
          if (Object.prototype.hasOwnProperty.call(balances, symbol)) {
            const balance = balances[symbol];
            responseText += `${symbol}: ${balance.formatted}\n`;
          }
        }
      } else {
        responseText = 'Unable to retrieve token balances. You may need to initialize a manager first.';
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['BALANCES'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in BALANCES action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error retrieving token balances: ${(error as Error).message}`,
        actions: ['BALANCES'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'What are my token balances?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Here are your token balances:\nETH: 1.5\nUSDC: 100.0\nAERO: 50.0',
          actions: ['BALANCES'],
        },
      },
    ],
  ],
};

/**
 * Get Manager Address action
 * Returns the manager address from a smart contract
 */
const getManagerAddressAction: Action = {
  name: 'GET_MANAGER_ADDRESS',
  similes: ['MANAGER_ADDRESS', 'FIND_MANAGER', 'CONTRACT_MANAGER'],
  description: 'Returns the manager address from a smart contract',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<boolean> => {
    // Always valid for now, will add validation later
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling GET_MANAGER_ADDRESS action');

      // Fetch the actual manager address using our utility
      const managerAddress = await getManagerAddress();
      
      // Construct the response with the actual manager address
      const responseText = managerAddress 
        ? `The manager address is: ${managerAddress}`
        : 'No manager address found. You may need to create a manager first.';

      const responseContent: Content = {
        text: responseText,
        actions: ['GET_MANAGER_ADDRESS'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in GET_MANAGER_ADDRESS action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error retrieving manager address: ${(error as Error).message}`,
        actions: ['GET_MANAGER_ADDRESS'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'What is the manager address?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'The manager address is: 0x1234567890123456789012345678901234567890',
          actions: ['GET_MANAGER_ADDRESS'],
        },
      },
    ],
  ],
};

/**
 * Staked Positions action
 * Returns staked LP positions and rewards from Aerodrome
 */
const stakedPositionsAction: Action = {
  name: 'STAKED_POSITIONS',
  similes: ['LP_POSITIONS', 'STAKING_REWARDS', 'GAUGE_POSITIONS'],
  description: 'Returns staked LP positions and rewards from Aerodrome',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<boolean> => {
    // Always valid for now, will add validation later
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling STAKED_POSITIONS action');

      // Fetch staked positions using our utility
      const result = await getStakedPositions();
      
      let responseText = '';
      
      if (result) {
        // Check if there are any positions
        if (result.stakedPositions.length === 0) {
          responseText = 'You have no staked positions.';
        } else {
          // Format staked positions into a readable string
          responseText = 'Here are your staked positions:\n';
          
          result.stakedPositions.forEach((position, index) => {
            responseText += `${index + 1}. ${position.poolName}: ${position.formattedStakedBalance || position.stakedFormatted} LP tokens\n`;
            responseText += `   Earned rewards: ${position.formattedEarned || position.earnedFormatted} AERO\n`;
            
            if (position.claimable0 && position.token0Symbol) {
              responseText += `   Claimable ${position.token0Symbol}: ${position.formattedClaimable0}\n`;
            }
            
            if (position.claimable1 && position.token1Symbol) {
              responseText += `   Claimable ${position.token1Symbol}: ${position.formattedClaimable1}\n`;
            }
            
            responseText += '\n';
          });
          
          // Add total rewards
          responseText += `Total rewards: ${result.formattedTotalRewards} AERO`;
        }
      } else {
        responseText = 'Unable to retrieve staked positions. You may need to initialize a manager first.';
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['STAKED_POSITIONS'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in STAKED_POSITIONS action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error retrieving staked positions: ${(error as Error).message}`,
        actions: ['STAKED_POSITIONS'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'What are my staked positions?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Here are your staked positions:\n1. USDC-WETH: 0.25 LP tokens\n   Earned rewards: 5.2 AERO\n   Claimable USDC: 1.5\n   Claimable WETH: 0.001\n\nTotal rewards: 5.2 AERO',
          actions: ['STAKED_POSITIONS'],
        },
      },
    ],
  ],
};

/**
 * Add Liquidity action
 * Adds liquidity to a specific pool in Aerodrome and automatically stakes the LP tokens
 */
const addLiquidityAction: Action = {
  name: 'ADD_LIQUIDITY',
  similes: ['PROVIDE_LIQUIDITY', 'DEPOSIT_LP', 'JOIN_POOL'],
  description: 'Adds liquidity to a specified pool in Aerodrome and automatically stakes the LP tokens',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    // Check if a pool name is provided
    const text = message.content.text.toLowerCase();
    return text.includes('pool') || text.includes('liquidity');
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling ADD_LIQUIDITY action');

      // Extract pool name from message
      const text = message.content.text;
      let poolName = '';
      
      // Try to find pool name in common formats
      // Updated regex to handle both "pool USDC-AERO" and "USDC-AERO pool" formats
      const poolRegex = /([A-Za-z0-9]+-[A-Za-z0-9]+)(?:\s+pool)?|(?:pool|liquidity)(?:\s+(?:to|for|in|on))?\s+([A-Za-z0-9]+-[A-Za-z0-9]+)/i;
      const match = text.match(poolRegex);
      
      console.log('match', match);

      if (match && (match[1] || match[2])) {
        // Take whichever group matched
        poolName = (match[1] || match[2]).toUpperCase(); // Convert to uppercase for consistency
      } else {
        // Default to USDC-WETH if no pool specified
        poolName = 'USDC-WETH';
      }
      
      // Inform the user about the pool being used
      const initialResponse: Content = {
        text: `Adding liquidity to the ${poolName} pool and staking LP tokens. This may take a moment...`,
        actions: ['ADD_LIQUIDITY'],
        source: message.content.source,
      };
      await callback(initialResponse);
      
      // Add liquidity to the specified pool and stake the resulting LP tokens
      const result = await addLiquidityAndStake(poolName) as AddLiquidityAndStakeResult;
      
      let responseText = '';
      
      if (result.success) {
        // Format successful response
        responseText = `Successfully added liquidity to the ${poolName} pool.\n`;
        
        if (result.tokenA && result.tokenB) {
          responseText += `Added ${result.tokenA.amount} ${result.tokenA.symbol} and ${result.tokenB.amount} ${result.tokenB.symbol}.\n`;
        }
        
        if (result.lpTokenInfo && result.lpTokenInfo.liquidity) {
          responseText += `Received ${result.lpTokenInfo.liquidity} LP tokens.\n`;
        }
        
        // Add staking information if available
        if (result.staked) {
          responseText += `LP tokens were automatically staked.`;
          if (result.stakeResult && result.stakeResult.txHash) {
            responseText += ` Staking transaction hash: ${result.stakeResult.txHash}`;
          }
        } else if (result.stakeResult) {
          responseText += `Could not stake LP tokens: ${result.stakeResult.message}`;
        }
      } else {
        // Format error response
        responseText = `Failed to add liquidity to the ${poolName} pool: ${result.message}`;
        
        // Check for insufficient balance
        if (result.message && result.message.includes('Insufficient balance')) {
          responseText += '\nPlease deposit tokens first using the DEPOSIT_TOKEN action.';
        }
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['ADD_LIQUIDITY'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in ADD_LIQUIDITY action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error adding liquidity: ${(error as Error).message}`,
        actions: ['ADD_LIQUIDITY'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Add liquidity to the USDC-WETH pool',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Successfully added liquidity to the USDC-WETH pool.\nAdded 100 USDC and 0.05 WETH.\nReceived 0.0123 LP tokens.\nLP tokens were automatically staked.',
          actions: ['ADD_LIQUIDITY'],
        },
      },
    ],
  ],
};

/**
 * Deposit Tokens action
 * Deposits tokens into the Aerodrome manager contract
 */
const depositTokensAction: Action = {
  name: 'DEPOSIT_TOKENS',
  similes: ['DEPOSIT', 'FUND_MANAGER', 'SEND_TOKENS'],
  description: 'Deposits tokens into the Aerodrome manager contract',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    // Check if a token and amount are mentioned
    const text = message.content.text.toLowerCase();
    return text.includes('deposit') || text.includes('send') || text.includes('token');
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling DEPOSIT_TOKENS action');

      // Extract token and amount from message
      const text = message.content.text;
      
      // Try to find token symbol in common formats
      // Look for token symbols like USDC, WETH, AERO, etc.
      const tokenRegex = /(USDC|WETH|AERO|VIRTUAL|TN100x|VEIL)/i;
      const tokenMatch = text.match(tokenRegex);
      
      let tokenSymbol = '';
      if (tokenMatch && tokenMatch[1]) {
        tokenSymbol = tokenMatch[1].toUpperCase(); // Convert to uppercase for consistency
      } else {
        // Default to USDC if no token specified
        tokenSymbol = 'USDC';
      }
      
      // Try to find amount
      const amountRegex = /(\d+(?:\.\d+)?)\s*(USDC|WETH|AERO|VIRTUAL|TN100x|VEIL)/i;
      const amountMatch = text.match(amountRegex);
      
      let amount = 0;
      if (amountMatch && amountMatch[1]) {
        amount = parseFloat(amountMatch[1]);
      } else {
        // Default amounts based on token
        switch (tokenSymbol) {
          case 'USDC':
            amount = 10; // Default 10 USDC
            break;
          case 'WETH':
            amount = 0.01; // Default 0.01 WETH
            break;
          case 'AERO':
            amount = 1; // Default 1 AERO
            break;
          default:
            amount = 1; // Default 1 for other tokens
        }
      }
      
      // Inform the user about the deposit
      const initialResponse: Content = {
        text: `Depositing ${amount} ${tokenSymbol} into the manager. This may take a moment...`,
        actions: ['DEPOSIT_TOKENS'],
        source: message.content.source,
      };
      await callback(initialResponse);
      
      // Deposit tokens
      const result = await depositTokens(tokenSymbol, amount);
      
      let responseText = '';
      
      if (result.success) {
        // Format successful response
        responseText = `Successfully deposited ${amount} ${tokenSymbol} into the manager.`;
        
        if (result.txHash) {
          responseText += `\nTransaction hash: ${result.txHash}`;
        }
      } else {
        // Format error response
        responseText = `Failed to deposit ${amount} ${tokenSymbol}: ${result.message}`;
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['DEPOSIT_TOKENS'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in DEPOSIT_TOKENS action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error depositing tokens: ${(error as Error).message}`,
        actions: ['DEPOSIT_TOKENS'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Deposit 10 USDC to the manager',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Successfully deposited 10 USDC into the manager.\nTransaction hash: 0x1234...',
          actions: ['DEPOSIT_TOKENS'],
        },
      },
    ],
  ],
};

/**
 * Liquidate Position action
 * Unstakes and removes liquidity for a specified token pair
 */
const liquidatePositionAction: Action = {
  name: 'LIQUIDATE_POSITION',
  similes: ['UNSTAKE_AND_REMOVE', 'EXIT_POSITION', 'CLOSE_POSITION'],
  description: 'Unstakes LP tokens and removes liquidity from a specified pool',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    // Check if a pool name or liquidate term is mentioned
    const text = message.content.text.toLowerCase();
    return text.includes('pool') || text.includes('liquidate') || text.includes('unstake') || text.includes('remove');
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling LIQUIDATE_POSITION action');

      // Extract pool name from message
      const text = message.content.text;
      let poolName = '';
      
      // Try to find pool name in common formats
      const poolRegex = /([A-Za-z0-9]+-[A-Za-z0-9]+)(?:\s+pool)?|(?:pool|position|liquidity)(?:\s+(?:for|in|on))?\s+([A-Za-z0-9]+-[A-Za-z0-9]+)/i;
      const match = text.match(poolRegex);
      
      if (match && (match[1] || match[2])) {
        // Take whichever group matched
        poolName = (match[1] || match[2]).toUpperCase(); // Convert to uppercase for consistency
      } else {
        // If no pool specified, tell the user we need a pool name
        const missingPoolResponse: Content = {
          text: `Please specify which pool you want to liquidate (e.g., "liquidate USDC-WETH pool").`,
          actions: ['LIQUIDATE_POSITION'],
          source: message.content.source,
        };
        await callback(missingPoolResponse);
        return missingPoolResponse;
      }
      
      // Inform the user about the operation
      const initialResponse: Content = {
        text: `Liquidating your position in the ${poolName} pool. This will unstake LP tokens and remove liquidity. This may take a moment...`,
        actions: ['LIQUIDATE_POSITION'],
        source: message.content.source,
      };
      await callback(initialResponse);
      
      // Perform the operation
      const result = await unstakeAndRemoveLiquidity(poolName) as UnstakeAndRemoveLiquidityResult;
      
      let responseText = '';
      
      if (result.success) {
        // Format successful response
        responseText = `Successfully liquidated your position in the ${poolName} pool.\n`;
        
        // Add details about unstaking
        if (result.unstaked) {
          responseText += `LP tokens were unstaked from the gauge.\n`;
        }
        
        // Add details about removing liquidity
        if (result.removed && result.removeResult) {
          responseText += `Liquidity was removed from the pool.\n`;
          
          // Try to include token amounts if available
          if (result.removeResult.amountA && result.removeResult.amountB) {
            responseText += `Received tokens from the pool.\n`;
          }
          
          if (result.removeResult.txHash) {
            responseText += `Remove liquidity transaction hash: ${result.removeResult.txHash}\n`;
          }
        } else if (result.unstaked) {
          // Partial success - unstaked but not removed
          responseText += `Warning: ${result.message}\n`;
        }
      } else {
        // Format error response
        responseText = `Failed to liquidate position in the ${poolName} pool: ${result.message}`;
        
        // Add more specific guidance based on the error
        if (result.message && result.message.includes('No staked position found')) {
          responseText += '\nYou might not have any staked LP tokens in this pool. Check your positions with the STAKED_POSITIONS action.';
        }
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['LIQUIDATE_POSITION'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in LIQUIDATE_POSITION action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error liquidating position: ${(error as Error).message}`,
        actions: ['LIQUIDATE_POSITION'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Liquidate my USDC-WETH position',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Successfully liquidated your position in the USDC-WETH pool.\nLP tokens were unstaked from the gauge.\nLiquidity was removed from the pool.\nReceived tokens from the pool.',
          actions: ['LIQUIDATE_POSITION'],
        },
      },
    ],
  ],
};

/**
 * Withdraw Tokens action
 * Withdraws tokens from the Aerodrome manager contract
 */
const withdrawTokensAction: Action = {
  name: 'WITHDRAW_TOKENS',
  similes: ['WITHDRAW', 'GET_TOKENS', 'TAKE_OUT'],
  description: 'Withdraws tokens from the Aerodrome manager contract',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    // Check if a withdraw-related term is mentioned
    const text = message.content.text.toLowerCase();
    return text.includes('withdraw') || text.includes('get') || text.includes('take');
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling WITHDRAW_TOKENS action');

      // Extract token and amount from message
      const text = message.content.text;
      
      // Try to find token symbol in common formats
      // Look for token symbols like USDC, WETH, AERO, etc.
      const tokenRegex = /(USDC|WETH|AERO|VIRTUAL|TN100x|VEIL)/i;
      const tokenMatch = text.match(tokenRegex);
      
      let tokenSymbol = '';
      if (tokenMatch && tokenMatch[1]) {
        tokenSymbol = tokenMatch[1].toUpperCase(); // Convert to uppercase for consistency
      } else {
        // If no token specified, ask the user to specify
        const missingTokenResponse: Content = {
          text: `Please specify which token you want to withdraw (e.g., "withdraw USDC" or "withdraw all WETH").`,
          actions: ['WITHDRAW_TOKENS'],
          source: message.content.source,
        };
        await callback(missingTokenResponse);
        return missingTokenResponse;
      }
      
      // Try to find amount
      let amount: number | string = "ALL"; // Default to ALL
      
      // Check if "all" is specified
      const allRegex = /\b(all|max)\b/i;
      const allMatch = text.match(allRegex);
      
      if (!allMatch) {
        // Try to find a specific amount
        const amountRegex = /(\d+(?:\.\d+)?)\s*(USDC|WETH|AERO|VIRTUAL|TN100x|VEIL)?/i;
        const amountMatch = text.match(amountRegex);
        
        if (amountMatch && amountMatch[1]) {
          amount = parseFloat(amountMatch[1]);
        }
      }
      
      // Inform the user about the withdrawal
      const initialResponse: Content = {
        text: `Withdrawing ${amount === "ALL" ? "all" : amount} ${tokenSymbol} from the manager. This may take a moment...`,
        actions: ['WITHDRAW_TOKENS'],
        source: message.content.source,
      };
      await callback(initialResponse);
      
      // Withdraw tokens
      const result = await withdrawTokens(tokenSymbol, amount) as WithdrawTokensResult;
      
      let responseText = '';
      
      if (result.success) {
        // Format successful response
        const amountText = result.amount === "ALL" ? "all" : result.amount;
        responseText = `Successfully withdrew ${amountText} ${tokenSymbol} from the manager.`;
        
        if (result.txHash) {
          responseText += `\nTransaction hash: ${result.txHash}`;
        }
      } else {
        // Format error response
        responseText = `Failed to withdraw tokens: ${result.message}`;
        
        // Add more specific guidance based on common errors
        if (result.message && result.message.includes('Insufficient balance')) {
          responseText += `\nYou don't have enough ${tokenSymbol} in the manager. Check your balances with the BALANCES action.`;
        }
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['WITHDRAW_TOKENS'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in WITHDRAW_TOKENS action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error withdrawing tokens: ${(error as Error).message}`,
        actions: ['WITHDRAW_TOKENS'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Withdraw all my USDC',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Successfully withdrew all USDC from the manager.\nTransaction hash: 0x1234...',
          actions: ['WITHDRAW_TOKENS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Withdraw 5 WETH',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Successfully withdrew 5 WETH from the manager.\nTransaction hash: 0x5678...',
          actions: ['WITHDRAW_TOKENS'],
        },
      },
    ],
  ],
};

/**
 * Claim Rewards action
 * Claims rewards from staked positions in Aerodrome
 */
const claimRewardsAction: Action = {
  name: 'CLAIM_REWARDS',
  similes: ['CLAIM', 'HARVEST_REWARDS', 'GET_REWARDS'],
  description: 'Claims rewards from staked positions in Aerodrome pools',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    // Check if a claim-related term is mentioned
    const text = message.content.text.toLowerCase();
    return text.includes('claim') || text.includes('harvest') || text.includes('rewards');
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling CLAIM_REWARDS action');

      // Check if the message mentions "all" rewards
      const text = message.content.text.toLowerCase();
      const claimAll = text.includes('all');
      
      // If not claiming all, try to find pool name
      let poolName = '';
      if (!claimAll) {
        // Try to find pool name in common formats
        const poolRegex = /([A-Za-z0-9]+-[A-Za-z0-9]+)(?:\s+pool)?|(?:pool|position|rewards)(?:\s+(?:for|in|on|from))?\s+([A-Za-z0-9]+-[A-Za-z0-9]+)/i;
        const match = text.match(poolRegex);
        
        if (match && (match[1] || match[2])) {
          // Take whichever group matched
          poolName = (match[1] || match[2]).toUpperCase(); // Convert to uppercase for consistency
        }
      }
      
      let initialResponse: Content;
      
      if (claimAll) {
        // Claiming all rewards
        initialResponse = {
          text: `Claiming rewards from all eligible pools. This may take a moment...`,
          actions: ['CLAIM_REWARDS'],
          source: message.content.source,
        };
      } else if (poolName) {
        // Claiming rewards from a specific pool
        initialResponse = {
          text: `Claiming rewards from the ${poolName} pool. This may take a moment...`,
          actions: ['CLAIM_REWARDS'],
          source: message.content.source,
        };
      } else {
        // No pool specified and not claiming all
        const missingPoolResponse: Content = {
          text: `Please specify which pool you want to claim rewards from, or say "claim all rewards" to claim from all pools.`,
          actions: ['CLAIM_REWARDS'],
          source: message.content.source,
        };
        await callback(missingPoolResponse);
        return missingPoolResponse;
      }
      
      // Send initial response
      await callback(initialResponse);
      
      // Perform the claim operation
      let responseText = '';
      
      if (claimAll) {
        // Claim from all pools
        const results = await claimAllPoolRewards();
        
        if (results.length === 0) {
          responseText = "No eligible pools found for claiming rewards.";
        } else if (results.length === 1 && !results[0].success) {
          // Single error result
          responseText = `Failed to claim rewards: ${results[0].message}`;
        } else {
          // Success or partial success
          const successResults = results.filter(r => r.success);
          const failureResults = results.filter(r => !r.success);
          
          if (successResults.length > 0) {
            responseText = `Successfully claimed rewards from ${successResults.length} pool${successResults.length !== 1 ? 's' : ''}.`;
            
            // Add details about claimed pools if available
            const poolNames = successResults
              .filter(r => r.poolName)
              .map(r => r.poolName);
              
            if (poolNames.length > 0) {
              responseText += `\nClaimed pools: ${poolNames.join(', ')}`;
            }
          }
          
          // Add info about failures if any
          if (failureResults.length > 0) {
            if (responseText) responseText += '\n\n';
            responseText += `Failed to claim rewards from ${failureResults.length} pool${failureResults.length !== 1 ? 's' : ''}.`;
            
            // Add reason for first failure
            if (failureResults[0].message) {
              responseText += `\nReason: ${failureResults[0].message}`;
            }
          }
        }
      } else {
        // Claim from specific pool
        const result = await claimPoolRewards(poolName);
        
        if (result.success) {
          responseText = `Successfully claimed rewards from the ${poolName} pool.`;
          
          if (result.amountClaimed) {
            responseText += `\nAmount claimed: ${result.amountClaimed} AERO`;
          }
          
          if (result.txHash) {
            responseText += `\nTransaction hash: ${result.txHash}`;
          }
        } else {
          responseText = `Failed to claim rewards from the ${poolName} pool: ${result.message}`;
          
          // Add more specific guidance based on common errors
          if (result.message && result.message.includes('No rewards')) {
            responseText += `\nYou might need to wait longer for rewards to accumulate.`;
          } else if (result.message && result.message.includes('No staked position found')) {
            responseText += `\nYou don't have any staked LP tokens in this pool. Check your positions with the STAKED_POSITIONS action.`;
          }
        }
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['CLAIM_REWARDS'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in CLAIM_REWARDS action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error claiming rewards: ${(error as Error).message}`,
        actions: ['CLAIM_REWARDS'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Claim rewards from USDC-WETH pool',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Successfully claimed rewards from the USDC-WETH pool.\nAmount claimed: 10.5 AERO\nTransaction hash: 0x1234...',
          actions: ['CLAIM_REWARDS'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Claim all my rewards',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Successfully claimed rewards from 3 pools.\nClaimed pools: USDC-WETH, USDC-AERO, WETH-AERO',
          actions: ['CLAIM_REWARDS'],
        },
      },
    ],
  ],
};

/**
 * Claim Fees action
 * Claims trading fees from a specific pool in Aerodrome
 */
const claimFeesAction: Action = {
  name: 'CLAIM_FEES',
  similes: ['COLLECT_FEES', 'GET_FEES', 'COLLECT_TRADING_FEES'],
  description: 'Claims trading fees from a specific pool in Aerodrome',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    // Check if a fee-related term is mentioned
    const text = message.content.text.toLowerCase();
    return text.includes('fee') || text.includes('collect') || 
           (text.includes('claim') && !text.includes('reward'));
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling CLAIM_FEES action');

      // Extract pool name from message
      const text = message.content.text;
      let poolName = '';
      
      // Try to find pool name in common formats
      const poolRegex = /([A-Za-z0-9]+-[A-Za-z0-9]+)(?:\s+pool)?|(?:pool|position|fees)(?:\s+(?:for|in|on|from))?\s+([A-Za-z0-9]+-[A-Za-z0-9]+)/i;
      const match = text.match(poolRegex);
      
      if (match && (match[1] || match[2])) {
        // Take whichever group matched
        poolName = (match[1] || match[2]).toUpperCase(); // Convert to uppercase for consistency
      } else {
        // If no pool specified, ask the user to specify
        const missingPoolResponse: Content = {
          text: `Please specify which pool you want to claim fees from (e.g., "claim fees from USDC-WETH pool").`,
          actions: ['CLAIM_FEES'],
          source: message.content.source,
        };
        await callback(missingPoolResponse);
        return missingPoolResponse;
      }
      
      // Inform the user about the operation
      const initialResponse: Content = {
        text: `Claiming trading fees from the ${poolName} pool. This may take a moment...`,
        actions: ['CLAIM_FEES'],
        source: message.content.source,
      };
      await callback(initialResponse);
      
      // Perform the claim operation
      const result = await claimPoolFees(poolName) as ClaimFeesResult;
      
      let responseText = '';
      
      if (result.success) {
        // Format successful response
        responseText = `Successfully claimed trading fees from the ${poolName} pool.`;
        
        // Add token amounts if available
        if (result.amount0Received && result.amount1Received) {
          const token0Symbol = poolName.split('-')[0];
          const token1Symbol = poolName.split('-')[1];
          
          // Format amounts more nicely if they are BigInt
          const amount0 = typeof result.formattedAmount0 === 'string' ? 
                          result.formattedAmount0 : 
                          (result.amount0Received ? result.amount0Received.toString() : '0');
                          
          const amount1 = typeof result.formattedAmount1 === 'string' ? 
                          result.formattedAmount1 : 
                          (result.amount1Received ? result.amount1Received.toString() : '0');
          
          responseText += `\nReceived: ${amount0} ${token0Symbol} and ${amount1} ${token1Symbol}`;
        }
        
        if (result.txHash) {
          responseText += `\nTransaction hash: ${result.txHash}`;
        }
      } else {
        // Format error response
        responseText = `Failed to claim trading fees from the ${poolName} pool: ${result.message}`;
        
        // Add more specific guidance for common errors
        if (result.message && result.message.includes('Could not find addresses')) {
          responseText += `\nPlease make sure you're using valid token symbols (e.g., USDC-WETH).`;
        } else if (result.message && result.message.includes('No fees')) {
          responseText += `\nThere might not be any trading fees to claim yet. Trading fees accumulate over time as the pool is used.`;
        }
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['CLAIM_FEES'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in CLAIM_FEES action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error claiming trading fees: ${(error as Error).message}`,
        actions: ['CLAIM_FEES'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Claim fees from USDC-WETH pool',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Successfully claimed trading fees from the USDC-WETH pool.\nReceived: 0.5 USDC and 0.0001 WETH\nTransaction hash: 0x1234...',
          actions: ['CLAIM_FEES'],
        },
      },
    ],
  ],
};

/**
 * Show Claimable Fees action
 * Displays the trading fees available to claim from pools
 */
const showClaimableFeesAction: Action = {
  name: 'SHOW_CLAIMABLE_FEES',
  similes: ['DISPLAY_FEES', 'GET_CLAIMABLE_FEES', 'CHECK_FEES'],
  description: 'Displays the trading fees available to claim from pools',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    // Check if message contains relevant terms
    const text = message.content.text.toLowerCase();
    return (text.includes('fee') || text.includes('claimable')) && 
           (text.includes('show') || text.includes('display') || text.includes('check') || 
            text.includes('get') || text.includes('view') || text.includes('available'));
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling SHOW_CLAIMABLE_FEES action');

      // Check if a specific pool is mentioned
      const text = message.content.text;
      let poolName = '';
      let showAllPools = true;
      
      // Try to find pool name in common formats if present
      const poolRegex = /([A-Za-z0-9]+-[A-Za-z0-9]+)(?:\s+pool)?|(?:pool|position|fees)(?:\s+(?:for|in|on|from))?\s+([A-Za-z0-9]+-[A-Za-z0-9]+)/i;
      const match = text.match(poolRegex);
      
      if (match && (match[1] || match[2])) {
        // Take whichever group matched
        poolName = (match[1] || match[2]).toUpperCase(); // Convert to uppercase for consistency
        showAllPools = false;
      }
      
      // Inform the user about the operation
      let initialResponse: Content;
      
      if (showAllPools) {
        initialResponse = {
          text: `Checking claimable trading fees for all active pools. This may take a moment...`,
          actions: ['SHOW_CLAIMABLE_FEES'],
          source: message.content.source,
        };
      } else {
        initialResponse = {
          text: `Checking claimable trading fees for the ${poolName} pool. This may take a moment...`,
          actions: ['SHOW_CLAIMABLE_FEES'],
          source: message.content.source,
        };
      }
      
      await callback(initialResponse);
      
      // Get the claimable fees data
      let results: ClaimableFeesResult[] = [];
      
      if (showAllPools) {
        results = await getAllClaimableFees();
      } else {
        const result = await getPoolClaimableFees(poolName);
        results = [result];
      }
      
      // Format the response
      let responseText = '';
      
      // Check if we have valid results
      if (results.length === 0) {
        responseText = "No active pools found with claimable fees.";
      } else if (results.length === 1 && !results[0].success && results[0].poolName === "None") {
        responseText = "No active LP positions found. You need to add liquidity to a pool first.";
      } else {
        // Find successful results with claimable fees
        const successfulResults = results.filter(r => r.success);
        
        if (successfulResults.length === 0) {
          // All results failed
          responseText = "Could not retrieve claimable fees for any pools.";
          
          // Add the first error message
          if (results[0].message) {
            responseText += `\nError: ${results[0].message}`;
          }
        } else {
          // Have at least one successful result
          if (showAllPools) {
            responseText = "Claimable trading fees for your active pools:\n\n";
          } else {
            responseText = `Claimable trading fees for the ${poolName} pool:\n\n`;
          }
          
          // Process each successful result
          let hasClaimableFees = false;
          
          for (const result of successfulResults) {
            // Skip if we don't have token symbols or formatted amounts
            if (!result.token0Symbol || !result.token1Symbol || 
                !result.formattedClaimable0 || !result.formattedClaimable1) {
              continue;
            }
            
            // Check if any fees are claimable (non-zero)
            const hasClaimable0 = result.formattedClaimable0 !== "0" && 
                                  result.formattedClaimable0 !== "0.0" && 
                                  result.formattedClaimable0 !== "0.00";
                                  
            const hasClaimable1 = result.formattedClaimable1 !== "0" && 
                                  result.formattedClaimable1 !== "0.0" && 
                                  result.formattedClaimable1 !== "0.00";
            
            // Always display the pool, even if all fees are zero
            responseText += `${result.poolName}:\n`;
            
            // Display token0 balance, indicating if it's claimable or not
            responseText += `- ${result.formattedClaimable0} ${result.token0Symbol}`;
            if (!hasClaimable0) {
              responseText += " (nothing to claim)";
            }
            responseText += "\n";
            
            // Display token1 balance, indicating if it's claimable or not
            responseText += `- ${result.formattedClaimable1} ${result.token1Symbol}`;
            if (!hasClaimable1) {
              responseText += " (nothing to claim)";
            }
            responseText += "\n\n";
            
            // Track if at least one pool has non-zero fees
            if (hasClaimable0 || hasClaimable1) {
              hasClaimableFees = true;
            }
          }
          
          // Change this section to only add the claiming instructions if there are fees
          if (hasClaimableFees) {
            // Add instructions for claiming
            responseText += "To claim these fees, use the CLAIM_FEES action with a specific pool name.";
          } else {
            // All fees are zero, add explanation
            if (showAllPools) {
              responseText += "None of your pools have claimable trading fees at this time.\n";
              responseText += "Trading fees accumulate as users trade through your pool.";
            } else {
              responseText += `The ${poolName} pool has no claimable trading fees at this time.\n`;
              responseText += "Trading fees accumulate as users trade through your pool.";
            }
          }
        }
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['SHOW_CLAIMABLE_FEES'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in SHOW_CLAIMABLE_FEES action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error checking claimable fees: ${(error as Error).message}`,
        actions: ['SHOW_CLAIMABLE_FEES'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Show claimable fees for all my pools',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Claimable trading fees for your active pools:\n\nUSDC-WETH:\n- 0.5 USDC\n- 0.0001 WETH\n\nUSDC-AERO:\n- 0.2 USDC\n- 0.0 AERO (nothing to claim)\n\nWETH-VEIL:\n- 0.0 WETH (nothing to claim)\n- 0.0 VEIL (nothing to claim)\n\nTo claim these fees, use the CLAIM_FEES action with a specific pool name.',
          actions: ['SHOW_CLAIMABLE_FEES'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Check available fees for USDC-WETH pool',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Claimable trading fees for the USDC-WETH pool:\n\nUSDC-WETH:\n- 0.5 USDC\n- 0.0001 WETH\n\nTo claim these fees, use the CLAIM_FEES action with a specific pool name.',
          actions: ['SHOW_CLAIMABLE_FEES'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Check available fees for WETH-VEIL pool',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Claimable trading fees for the WETH-VEIL pool:\n\nWETH-VEIL:\n- 0.0 WETH (nothing to claim)\n- 0.0 VEIL (nothing to claim)\n\nThe WETH-VEIL pool has no claimable trading fees at this time.\nTrading fees accumulate as users trade through your pool.',
          actions: ['SHOW_CLAIMABLE_FEES'],
        },
      },
    ],
  ],
};

/**
 * Create Manager action
 * Creates a new Aerodrome manager contract for the user
 */
const createManagerAction: Action = {
  name: 'CREATE_MANAGER',
  similes: ['NEW_MANAGER', 'SETUP_MANAGER', 'INITIALIZE_MANAGER'],
  description: 'Creates a new Aerodrome manager contract if one does not already exist',

  validate: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
    // Check if message contains relevant terms about creating or setting up a manager
    const text = message.content.text.toLowerCase();
    return (text.includes('create') || text.includes('new') || text.includes('setup') || 
            text.includes('initialize') || text.includes('make')) && 
           (text.includes('manager') || text.includes('contract'));
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback,
    _responses: Memory[]
  ) => {
    try {
      logger.info('Handling CREATE_MANAGER action');

      // First check if a manager already exists
      const managerAddress = await getManagerAddress();
      
      if (managerAddress) {
        const alreadyExistsResponse: Content = {
          text: `You already have a manager contract at ${managerAddress}. No need to create a new one.`,
          actions: ['CREATE_MANAGER'],
          source: message.content.source,
        };
        await callback(alreadyExistsResponse);
        return alreadyExistsResponse;
      }
      
      // Inform the user about the operation
      const initialResponse: Content = {
        text: `Creating a new Aerodrome manager contract for you. This may take a moment...`,
        actions: ['CREATE_MANAGER'],
        source: message.content.source,
      };
      await callback(initialResponse);
      
      // Create the manager
      const result = await createNewManager() as CreateManagerResult;
      
      let responseText = '';
      
      if (result.success) {
        // Format successful response
        if (result.alreadyExists) {
          responseText = `You already have a manager contract at ${result.managerAddress}.`;
        } else {
          responseText = `Successfully created a new manager contract at ${result.managerAddress}.`;
          
          if (result.txHash) {
            responseText += `\nTransaction hash: ${result.txHash}`;
          }
          
          // Add next steps
          responseText += `\n\nNext steps:
1. Deposit tokens to your manager using the DEPOSIT_TOKENS action
2. Add liquidity to a pool using the ADD_LIQUIDITY action
3. Monitor your positions using the STAKED_POSITIONS action`;
        }
      } else {
        // Format error response
        responseText = `Failed to create manager contract: ${result.message}`;
        
        // Add troubleshooting info
        responseText += `\n\nPossible issues:
- Check that your wallet has ETH/BASE for gas
- Ensure your private key has the correct permissions
- Try again in a few minutes`;
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['CREATE_MANAGER'],
        source: message.content.source,
      };

      await callback(responseContent);
      return responseContent;
    } catch (error) {
      logger.error('Error in CREATE_MANAGER action:', error);
      
      // Handle error case
      const errorContent: Content = {
        text: `Error creating manager contract: ${(error as Error).message}`,
        actions: ['CREATE_MANAGER'],
        source: message.content.source,
      };
      
      await callback(errorContent);
      return errorContent;
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Create a new manager for me',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Successfully created a new manager contract at 0x1234567890abcdef1234567890abcdef12345678.\nTransaction hash: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890\n\nNext steps:\n1. Deposit tokens to your manager using the DEPOSIT_TOKENS action\n2. Add liquidity to a pool using the ADD_LIQUIDITY action\n3. Monitor your positions using the STAKED_POSITIONS action',
          actions: ['CREATE_MANAGER'],
        },
      },
    ],
  ],
};

export class StarterService extends Service {
  static serviceType = 'starter';
  capabilityDescription =
    'This is a starter service which is attached to the agent through the starter plugin.';
  constructor(protected runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info(`*** Starting starter service - MODIFIED: ${new Date().toISOString()} ***`);
    const service = new StarterService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** TESTING DEV MODE - STOP MESSAGE CHANGED! ***');
    // get the service from the runtime
    const service = runtime.getService(StarterService.serviceType);
    if (!service) {
      throw new Error('Starter service not found');
    }
    service.stop();
  }

  async stop() {
    logger.info('*** THIRD CHANGE - TESTING FILE WATCHING! ***');
  }
}

export const starterPlugin: Plugin = {
  name: 'plugin-proagent',
  description: 'Plugin starter for elizaOS',
  config: {
    EVM_PRIVATE_KEY: process.env.EVM_PRIVATE_KEY,
    EVM_PROVIDER_URL: process.env.EVM_PROVIDER_URL,
  },
  async init(config: Record<string, string>) {
    logger.info('*** TESTING DEV MODE - PLUGIN MODIFIED AND RELOADED! ***');
    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set all environment variables at once
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      throw error;
    }
  },
  models: {
    [ModelType.TEXT_SMALL]: async (
      _runtime,
      { prompt, stopSequences = [] }: GenerateTextParams
    ) => {
      return 'Never gonna give you up, never gonna let you down, never gonna run around and desert you...';
    },
    [ModelType.TEXT_LARGE]: async (
      _runtime,
      {
        prompt,
        stopSequences = [],
        maxTokens = 8192,
        temperature = 0.7,
        frequencyPenalty = 0.7,
        presencePenalty = 0.7,
      }: GenerateTextParams
    ) => {
      return 'Never gonna make you cry, never gonna say goodbye, never gonna tell a lie and hurt you...';
    },
  },
  tests: [
    {
      name: 'plugin_starter_test_suite',
      tests: [
        {
          name: 'example_test',
          fn: async (runtime) => {
            logger.debug('example_test run by ', runtime.character.name);
            // Add a proper assertion that will pass
            if (runtime.character.name !== 'Eliza') {
              throw new Error(
                `Expected character name to be "Eliza" but got "${runtime.character.name}"`
              );
            }
            // Verify the plugin is loaded properly
            const service = runtime.getService('starter');
            if (!service) {
              throw new Error('Starter service not found');
            }
            // Don't return anything to match the void return type
          },
        },
        {
          name: 'should_have_hello_world_action',
          fn: async (runtime) => {
            // Check if the hello world action is registered
            // Look for the action in our plugin's actions
            // The actual action name in this plugin is "helloWorld", not "hello"
            const actionExists = starterPlugin.actions.some((a) => a.name === 'HELLO_WORLD');
            if (!actionExists) {
              throw new Error('Hello world action not found in plugin');
            }
          },
        },
        {
          name: 'should_have_manager_address_action',
          fn: async (runtime) => {
            // Check if the manager address action is registered
            const actionExists = starterPlugin.actions.some((a) => a.name === 'GET_MANAGER_ADDRESS');
            if (!actionExists) {
              throw new Error('Get manager address action not found in plugin');
            }
          },
        },
      ],
    },
  ],
  routes: [
    {
      path: '/helloworld',
      type: 'GET',
      handler: async (_req: any, res: any) => {
        // send a response
        res.json({
          message: 'Hello World!',
        });
      },
    },
  ],
  events: {
    MESSAGE_RECEIVED: [
      async (params) => {
        logger.debug('MESSAGE_RECEIVED event received');
        // print the keys
        logger.debug(Object.keys(params));
      },
    ],
    VOICE_MESSAGE_RECEIVED: [
      async (params) => {
        logger.debug('VOICE_MESSAGE_RECEIVED event received');
        // print the keys
        logger.debug(Object.keys(params));
      },
    ],
    WORLD_CONNECTED: [
      async (params) => {
        logger.debug('WORLD_CONNECTED event received');
        // print the keys
        logger.debug(Object.keys(params));
      },
    ],
    WORLD_JOINED: [
      async (params) => {
        logger.debug('WORLD_JOINED event received');
        // print the keys
        logger.debug(Object.keys(params));
      },
    ],
  },
  services: [StarterService],
  actions: [helloWorldAction, balancesAction, getManagerAddressAction, stakedPositionsAction, addLiquidityAction, depositTokensAction, liquidatePositionAction, withdrawTokensAction, claimRewardsAction, claimFeesAction, showClaimableFeesAction, createManagerAction],
  providers: [helloWorldProvider],
};

export default starterPlugin;
