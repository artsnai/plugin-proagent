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
import { getManagerAddress, getTokenBalances, getStakedPositions, addLiquidityAndStake, depositTokens, AddLiquidityAndStakeResult } from './aerodromeUtils';

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
  actions: [helloWorldAction, balancesAction, getManagerAddressAction, stakedPositionsAction, addLiquidityAction, depositTokensAction],
  providers: [helloWorldProvider],
};

export default starterPlugin;
