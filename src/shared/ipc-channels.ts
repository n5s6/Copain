/**
 * Strongly typed IPC Channel Constants
 */

export const IPC_CHANNELS = Object.freeze({
  CHAT_SEND_STREAM: 'chat:send-stream',
  CHAT_CANCEL_STREAM: 'chat:cancel-stream',
  CHAT_STREAM_CHUNK: 'chat:stream-chunk',
  SETTINGS_LOAD: 'settings:load',
  SETTINGS_SAVE: 'settings:save'
} as const);

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
