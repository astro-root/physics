import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();
app.listen(config.port, () => {
  console.log(`Dynamis API listening on http://localhost:${config.port}`);
  if (!config.isProd) console.log('Web client: http://localhost:5173');
});
