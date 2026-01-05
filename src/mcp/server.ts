/*
 * Copyright (c) 2024 Provar Limited.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.md file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type TextContent,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Starts the ProvarDX MCP server
 * This server exposes ProvarDX capabilities as MCP tools that can be used by AI assistants
 */
export async function startMcpServer(): Promise<void> {
  const server = new Server(
    {
      name: 'provardx',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: 'provardx.ping',
        description: 'A simple ping tool to verify the MCP server is running',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    ],
  }));

  // Handle call tool request
  server.setRequestHandler(CallToolRequestSchema, (request) => {
    const { name } = request.params;

    if (name === 'provardx.ping') {
      const result = {
        ok: true,
        name: 'provardx',
        timestamp: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          } as TextContent,
        ],
      } as CallToolResult;
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  // eslint-disable-next-line no-console
  console.error('ProvarDX MCP server started successfully');
}
