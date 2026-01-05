/*
 * Copyright (c) 2024 Provar Limited.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.md file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@provartesting/provardx-cli', 'provar.mcp.start');

/**
 * Command to start the ProvarDX MCP server
 * This command starts a long-running MCP server that exposes ProvarDX capabilities
 * to AI assistants and other MCP clients
 */
export default class McpStart extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public async run(): Promise<void> {
    // Log startup message to stderr to avoid interfering with MCP protocol
    this.logToStderr('Starting ProvarDX MCP server...');

    // Import and start the MCP server
    // This will run indefinitely until the process is terminated
    const { startMcpServer } = await import('../../../mcp/server.js');
    await startMcpServer();
  }
}
