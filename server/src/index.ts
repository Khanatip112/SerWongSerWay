import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`🚀 PastelPulse server listening on port ${config.PORT} [${config.NODE_ENV}]`);
  console.log(`🔗 Allowed Client Origin: ${config.CLIENT_ORIGIN}`);
});