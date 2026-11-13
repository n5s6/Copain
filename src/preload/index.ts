import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  ElectronAPI,
  SendMessagePayload,
  StreamChunk,
  LLMConfig,
  SaveSettingsResult
} from '../shared/types';
import { IPC_CHANNELS } from '../shared/ipc-channels';

const electronAPI: ElectronAPI = {
  sendChatStream: (
    payload: SendMessagePayload,
    onChunk: (chunk: StreamChunk) => void
  ): (() => void) => {
    const chunkListener = (_event: IpcRendererEvent, chunk: StreamChunk): void => {
      onChunk(chunk);
    };

    ipcRenderer.on(IPC_CHANNELS.CHAT_STREAM_CHUNK, chunkListener);
    ipcRenderer.send(IPC_CHANNELS.CHAT_SEND_STREAM, payload);

    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.CHAT_STREAM_CHUNK, chunkListener);
    };
  },

  cancelChatStream: async (): Promise<void> => {
    await ipcRenderer.invoke(IPC_CHANNELS.CHAT_CANCEL_STREAM);
  },

  loadSettings: async (): Promise<LLMConfig> => {
    return await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_LOAD);
  },

  saveSettings: async (settings: LLMConfig): Promise<SaveSettingsResult> => {
    return await ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings);
  }
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  } catch (error) {
    console.error('Failed to expose electronAPI in main world:', error);
  }
} else {
  // Fallback for non-isolated test environments
  // @ts-ignore
  window.electronAPI = electronAPI;
}
