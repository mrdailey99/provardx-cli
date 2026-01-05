/*
 * Copyright (c) 2024 Provar Limited.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.md file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('MCP Server Module', () => {
  it('should export startMcpServer function', async () => {
    const mcpModule = await import('../../../../lib/mcp/server.js');
    expect(mcpModule).to.have.property('startMcpServer');
    expect(mcpModule.startMcpServer).to.be.a('function');
  });
});
