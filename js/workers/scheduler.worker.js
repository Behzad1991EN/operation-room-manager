import loadHighs from '../../vendor/highs/highs.mjs';
import { generateSchedule } from '../scheduler/engine.js';
self.onmessage = async ({ data }) => {
  if (data.type !== 'GENERATE_SCHEDULE') return;
  try {
    self.postMessage({ type: 'PROGRESS', message: 'Loading the local scheduling engine…' });
    const highs = await loadHighs({ locateFile: file => new URL(`../../vendor/highs/${file}`, import.meta.url).href });
    self.postMessage(generateSchedule(data.payload, highs, message => self.postMessage({ type: 'PROGRESS', message })));
  } catch (error) { self.postMessage({ type: 'ERROR', message: error.message || 'The scheduling engine could not start.' }); }
};
