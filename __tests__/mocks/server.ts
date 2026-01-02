/**
 * MSW Server Setup for API Mocking
 * This file configures Mock Service Worker for intercepting HTTP requests in tests.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create and export the MSW server with default handlers
export const server = setupServer(...handlers);
