import { MockOpenAIServer } from '../../mocks/mock-openai-server.ts';
import type { MockServerOptions } from '../../mocks/mock-openai-server.ts';

export interface MockServerFixture {
  server: MockOpenAIServer;
  baseUrl: string;
  start: () => Promise<string>;
  stop: () => Promise<void>;
  reset: () => void;
  setOptions: (options: Partial<MockServerOptions>) => void;
}

export function createMockServerFixture(options: MockServerOptions = {}): MockServerFixture {
  const server = new MockOpenAIServer(options);
  let baseUrl = '';

  return {
    server,
    get baseUrl() {
      return baseUrl;
    },
    start: async () => {
      baseUrl = await server.start();
      return baseUrl;
    },
    stop: async () => {
      await server.stop();
    },
    reset: () => {
      server.reset();
    },
    setOptions: (opts) => {
      server.setOptions(opts);
    }
  };
}
