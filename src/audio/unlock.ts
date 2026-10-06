import { sfx } from './sfx';
import { speech } from './speech';

/** Call from a click/tap handler: iOS only allows audio and speech to start inside a user gesture. */
export function unlockAudio() {
  sfx.unlock();
  speech.prime();
}
