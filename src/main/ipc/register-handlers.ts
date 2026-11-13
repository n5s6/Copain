import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { LLMConfig, SaveSettingsResult, SendMessagePayload, StreamChunk } from '../../shared/types';
import { streamChatCompletion } from '../services/openai-client';
import { SettingsService } from '../services/settings-service';

export function registerIpcHandlers(settingsService: SettingsService): void {
  const activeStreams = new Map<number, AbortController>();

  const abortActiveStream = (senderId: number): void => {
    const existing = activeStreams.get(senderId);
    if (existing) {
      existing.abort();
      activeStreams.delete(senderId);
    }
  };

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_LOAD,
    async (_event: IpcMainInvokeEvent): Promise<LLMConfig> => {
      return await settingsService.load();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SAVE,
    async (_event: IpcMainInvokeEvent, newSettings: LLMConfig): Promise<SaveSettingsResult> => {
      return await settingsService.save(newSettings);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CHAT_CANCEL_STREAM,
    async (event: IpcMainInvokeEvent): Promise<void> => {
      abortActiveStream(event.sender.id);
    }
  );

  ipcMain.on(
    IPC_CHANNELS.CHAT_SEND_STREAM,
    (event: IpcMainEvent, payload: SendMessagePayload): void => {
      const sender = event.sender;
      const senderId = sender.id;

      // Cancel any in-flight stream for this window before starting a new one
      abortActiveStream(senderId);

      const controller = new AbortController();
      activeStreams.set(senderId, controller);

      const sendChunk = (chunk: StreamChunk): void => {
        if (!sender.isDestroyed()) {
          sender.send(IPC_CHANNELS.CHAT_STREAM_CHUNK, chunk);
        }
      };

      void streamChatCompletion(payload, sendChunk, controller.signal).finally(() => {
        if (activeStreams.get(senderId) === controller) {
          activeStreams.delete(senderId);
        }
      });
    }
  );
}

