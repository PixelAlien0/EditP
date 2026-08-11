import { createServer } from 'vite';

export default async function startTestServer() {
  const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
  const server = await createServer({
    configLoader: 'native',
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true
    }
  });

  await server.listen();
  return async () => server.close();
}
