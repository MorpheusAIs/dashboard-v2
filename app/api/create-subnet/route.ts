import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { baseSepolia } from 'wagmi/chains';
import { parseEther, encodeFunctionData, createPublicClient, http } from 'viem';

// Import the BuildersV4 ABI
import BuildersV4Abi from '@/app/abi/BuildersV4.json';

// Import network config
import { testnetChains } from '@/config/networks';

// Options for subnet creation (matching frontend)
const SKILLS_OPTIONS = [
  { label: 'image2text', value: 'image2text' },
  { label: 'tts', value: 'tts' },
  { label: 'research', value: 'research' },
  { label: 'imagegen', value: 'imagegen' },
  { label: 'multimodal', value: 'multimodal' },
  { label: 'pdf extraction', value: 'pdf_extraction' },
  { label: 'ocr', value: 'ocr' },
  { label: 'text generation', value: 'text_generation' },
  { label: 'code generation', value: 'code_generation' },
  { label: 'data analysis', value: 'data_analysis' },
  { label: 'web scraping', value: 'web_scraping' },
  { label: 'api integration', value: 'api_integration' },
  { label: 'automation', value: 'automation' },
  { label: 'chat', value: 'chat' },
  { label: 'translation', value: 'translation' },
  { label: 'summarization', value: 'summarization' },
  { label: 'sentiment analysis', value: 'sentiment_analysis' },
  { label: 'classification', value: 'classification' },
];

const IO_TYPE_OPTIONS = [
  { label: 'Text', value: 'text' },
  { label: 'Image', value: 'image' },
  { label: 'Audio', value: 'audio' },
  { label: 'Video', value: 'video' },
];

const SUBNET_TYPE_OPTIONS = [
  { label: 'App', value: 'App' },
  { label: 'Agent', value: 'Agent' },
  { label: 'API server', value: 'API server' },
  { label: 'MCP server', value: 'MCP server' },
];

// Validation schema for subnet creation request
const createSubnetRequestSchema = z.object({
  name: z.string().min(1, "Subnet name is required"),
  minStake: z.number().min(0, "Minimum stake must be non-negative"),
  withdrawLockPeriod: z.number().min(7, "Withdraw lock period must be at least 7 days"),
  claimAdmin: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Please enter a valid Ethereum address"),
  description: z.string().min(1, "Description is required").max(3000, "Description must be 3000 characters or less"),
  website: z.string().url("Please enter a valid URL"),
  image: z.string().url("Please enter a valid URL for the logo").optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens").optional(),
  adminAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Please enter a valid admin Ethereum address"),
  // Extended metadata fields for Base Sepolia (non-App subnets)
  metadata_: z.object({
    description: z.string().optional(),
    endpointUrl: z.string().url("Please enter a valid URL").optional(),
    author: z.string().optional(),
    inputType: z.enum(['text', 'image', 'audio', 'video']).optional(),
    outputType: z.enum(['text', 'image', 'audio', 'video']).optional(),
    skills: z.array(z.string()).optional(),
    type: z.string().optional(),
    category: z.string().optional(),
  }).optional(),
});

export type CreateSubnetRequest = z.infer<typeof createSubnetRequestSchema>;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET() {
  try {
    // Custom JSON serializer that handles BigInt values
    const serializeWithBigInt = (obj: unknown): string => {
      return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
    };

    const response = {
      options: {
        skills: SKILLS_OPTIONS,
        inputTypes: IO_TYPE_OPTIONS,
        outputTypes: IO_TYPE_OPTIONS,
        subnetTypes: SUBNET_TYPE_OPTIONS,
      },
      // Also provide schema information for API consumers
      schema: {
        required: ['name', 'minStake', 'withdrawLockPeriod', 'claimAdmin', 'description', 'website', 'adminAddress'],
        optional: ['image', 'slug', 'metadata_'],
        metadataFields: {
          description: 'string',
          endpointUrl: 'string (URL)',
          author: 'string',
          inputType: 'enum: text|image|audio|video',
          outputType: 'enum: text|image|audio|video',
          skills: 'array<string>',
          type: 'string',
          category: 'string',
        }
      },
      // Example request structure for API consumers
      exampleRequest: {
        name: "My Subnet",
        minStake: 10,
        withdrawLockPeriod: 7,
        claimAdmin: "0x1234567890123456789012345678901234567890",
        description: "A description of my subnet",
        website: "https://example.com",
        adminAddress: "0x1234567890123456789012345678901234567890",
        image: "https://example.com/logo.png",
        slug: "my-subnet",
        metadata_: {
          description: "Extended description",
          endpointUrl: "https://api.example.com",
          author: "Author Name",
          inputType: "text",
          outputType: "text",
          skills: ["image2text", "research", "chat"],
          type: "Agent",
          category: "AI"
        }
      }
    };

    return new NextResponse(serializeWithBigInt(response), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching subnet options:', error);
    const serializeWithBigInt = (obj: unknown): string => {
      return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
    };
    return new NextResponse(serializeWithBigInt({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = createSubnetRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const serializeWithBigInt = (obj: unknown): string => {
        return JSON.stringify(obj, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
      };
      return new NextResponse(serializeWithBigInt({
        error: 'Validation failed',
        details: validationResult.error.format()
      }), {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json',
        },
      });
    }

    const data = validationResult.data;

    // Get contract addresses for Base Sepolia
    const buildersContractAddress = testnetChains.baseSepolia.contracts?.builders?.address;
    const morTokenAddress = testnetChains.baseSepolia.contracts?.morToken?.address;

    if (!buildersContractAddress || !morTokenAddress) {
      const serializeWithBigInt = (obj: unknown): string => {
        return JSON.stringify(obj, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
      };
      return new NextResponse(serializeWithBigInt({ error: 'Contract addresses not configured' }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json',
        },
      });
    }

    // Construct subnet struct
    const subnetStruct = {
      name: data.name,
      admin: data.adminAddress as `0x${string}`,
      unusedStorage1_V4Update: BigInt(0), // Set to 0 as unused
      withdrawLockPeriodAfterDeposit: BigInt(data.withdrawLockPeriod * 86400), // Convert days to seconds
      unusedStorage2_V4Update: BigInt(0), // Set to 0 as unused
      minimalDeposit: parseEther(data.minStake.toString()),
      claimAdmin: data.claimAdmin as `0x${string}`,
    };

    // Construct metadata struct
    let description = data.description;

    // For Base Sepolia subnets with extended metadata, wrap it in metadata_ structure
    if (data.metadata_) {
      try {
        const combinedData = {
          metadata_: {
            description: data.metadata_.description || data.description,
            endpointUrl: data.metadata_.endpointUrl || "",
            author: data.metadata_.author || "",
            inputType: data.metadata_.inputType || "",
            outputType: data.metadata_.outputType || "",
            skills: data.metadata_.skills || [],
            type: data.metadata_.type || "",
            category: data.metadata_.category || "",
          },
          timestamp: Date.now(),
        };
        description = JSON.stringify(combinedData);
      } catch (error) {
        console.error('Error processing metadata_:', error);
        const serializeWithBigInt = (obj: unknown): string => {
          return JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          );
        };
        return new NextResponse(serializeWithBigInt({ error: 'Invalid metadata format' }), {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json',
          },
        });
      }
    }

    const metadataStruct = {
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
      description: description,
      website: data.website,
      image: data.image || ""
    };

    // Encode the function call data
    let functionData: string;
    try {
      const encoded = encodeFunctionData({
        abi: BuildersV4Abi,
        functionName: 'createSubnet',
        args: [subnetStruct, metadataStruct]
      });
      functionData = encoded;
    } catch (error) {
      console.error('Error encoding function data:', error);
      const serializeWithBigInt = (obj: unknown): string => {
        return JSON.stringify(obj, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
      };
      return new NextResponse(serializeWithBigInt({ error: 'Failed to encode contract call' }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json',
        },
      });
    }

    // Create the transaction object
    const transaction = {
      to: buildersContractAddress as `0x${string}`,
      data: functionData,
      chainId: baseSepolia.id,
      // Note: value is 0 since fee payment is handled via token approval
      value: '0x0',
    };

    // Query the actual creation fee from the BuildersV4 contract
    const INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY;
    const rpcUrl = `https://base-sepolia.infura.io/v3/${INFURA_API_KEY}`;
    
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    let creationFee: bigint;
    try {
      creationFee = await publicClient.readContract({
        address: buildersContractAddress as `0x${string}`,
        abi: BuildersV4Abi,
        functionName: 'subnetCreationFeeAmount',
      }) as bigint;
      
      console.log('[SubnetCreation API] Queried creation fee from contract:', creationFee.toString());
    } catch (error) {
      console.error('[SubnetCreation API] Failed to query creation fee from contract:', error);
      const serializeWithBigInt = (obj: unknown): string => {
        return JSON.stringify(obj, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
      };
      return new NextResponse(serializeWithBigInt({ 
        error: 'Failed to query subnet creation fee from contract. Please try again.' 
      }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json',
        },
      });
    }

    // Custom JSON serializer that handles BigInt values
    const serializeWithBigInt = (obj: unknown): string => {
      return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
    };

    // Return the transaction data along with additional info for the external app
    const response = {
      transaction,
      requirements: {
        network: {
          chainId: baseSepolia.id,
          name: baseSepolia.name,
        },
        tokenApproval: {
          tokenAddress: morTokenAddress,
          spenderAddress: buildersContractAddress,
          amount: creationFee.toString(),
        },
        gasEstimate: '1000000', // Conservative gas estimate
      },
      signingUrls: {
        // MetaMask deep link format
        metaMask: `https://metamask.app.link/dapp/your-app-url?tx=${encodeURIComponent(serializeWithBigInt(transaction))}`,
        // EIP-681 format (though limited for complex transactions)
        eip681: `ethereum:${buildersContractAddress}@${baseSepolia.id}?function=createSubnet&args=${encodeURIComponent(serializeWithBigInt([subnetStruct, metadataStruct]))}`,
      },
      instructions: [
        '1. Ensure user is connected to Base Sepolia network',
        `2. User must approve MOR token spending (${creationFee.toString()} wei) to the Builders contract`,
        '3. User signs and submits the createSubnet transaction',
        '4. Wait for transaction confirmation'
      ]
    };

    return new NextResponse(serializeWithBigInt(response), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error creating subnet transaction:', error);
    const serializeWithBigInt = (obj: unknown): string => {
      return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
    };
    return new NextResponse(serializeWithBigInt({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
    });
  }
}