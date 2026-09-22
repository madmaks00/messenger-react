import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { GameRoomDto, GameChatMessageDto } from '../types/dtos';
import { eventBus } from './eventBus';
import { BASE_SERVER_URL } from './apiClient';

export class GameSignalRService {
  private hubConnection: HubConnection | null = null;
  private readonly hubPath = 'hubs/game';

  public get isConnected(): boolean {
    return this.hubConnection !== null && this.hubConnection.state === HubConnectionState.Connected;
  }

  public async connectAsync(token: string): Promise<void> {
    if (!token) return;
    if (this.hubConnection) {
      await this.stopAsync();
    }

    const serverUrl = (BASE_SERVER_URL || 'https://localhost:7214').replace(/\/+$/, '');

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${serverUrl}/${this.hubPath}`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    this.registerHandlers();

    try {
      await this.hubConnection.start();
    } catch (err) {
      console.error('[GameSignalRService ERROR] Сбой подключения к хабу:', err);
      throw err;
    }
  }

  public async stopAsync(): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
      } catch (err) {
        console.error('[GameSignalRService ERROR] Ошибка при остановке соединения:', err);
      } finally {
        this.hubConnection = null;
      }
    }
  }

  private registerHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('ReceiveDrawingSync', (base64: string) => {
      eventBus.emit('GameDrawingSyncedMessage' as any, { base64Image: base64 });
    });
    this.hubConnection.on('RoomUpdated', (room: GameRoomDto) => {
      eventBus.emit('GameRoomUpdatedMessage' as any, { room });
    });
    this.hubConnection.on('GameStarted', (room: GameRoomDto) => {
      eventBus.emit('GameStartedMessage' as any, { room });
    });
    this.hubConnection.on('UpdateBoard', (room: GameRoomDto) => {
      eventBus.emit('GameBoardUpdatedMessage' as any, { room });
    });
    this.hubConnection.on('GameOver', (winnerId: number | null) => {
      eventBus.emit('GameOverMessage' as any, { winnerId });
    });
    this.hubConnection.on('PlayerLeft', (playerId: number) => {
      eventBus.emit('GamePlayerLeftMessage' as any, { playerId });
    });
    this.hubConnection.on('ReceiveMessage', (msg: GameChatMessageDto) => {
      eventBus.emit('GameChatMessageReceivedMessage' as any, { message: msg });
    });
  }

  public async createRoomAsync(gameType: string, password: string = ''): Promise<GameRoomDto> {
    if (!this.isConnected) throw new Error('Игровое соединение не установлено.');
    return await this.hubConnection!.invoke<GameRoomDto>('CreateRoom', gameType, password);
  }

  public async joinRoomAsync(roomId: string, password: string = ''): Promise<GameRoomDto> {
    if (!this.isConnected) throw new Error('Игровое соединение не установлено.');
    return await this.hubConnection!.invoke<GameRoomDto>('JoinRoom', roomId, password);
  }

  public async startGameAsync(roomId: string): Promise<void> {
    if (!this.isConnected) return;
    await this.hubConnection!.invoke('StartGame', roomId);
  }

  public async makeMoveAsync(roomId: string, fromIndex: number, toIndex: number): Promise<void> {
    if (!this.isConnected) return;
    await this.hubConnection!.invoke('MakeMove', roomId, fromIndex, toIndex);
  }

  public async leaveRoomAsync(roomId: string): Promise<void> {
    if (!this.isConnected) return;
    await this.hubConnection!.invoke('LeaveRoom', roomId);
  }

  public async sendChatMessageAsync(roomId: string, text: string): Promise<void> {
    if (!this.isConnected) return;
    await this.hubConnection!.invoke('SendChatMessage', roomId, text);
  }

  public async readyToPlayAsync(roomId: string, clientBoard: string[]): Promise<void> {
    if (!this.isConnected) return;
    await this.hubConnection!.invoke('ReadyToPlay', roomId, clientBoard);
  }

  public async voteWordAsync(roomId: string, word: string): Promise<void> {
    if (!this.isConnected) return;
    await this.hubConnection!.invoke('VoteWord', roomId, word);
  }

  public async submitDrawingAsync(roomId: string, base64Image: string): Promise<void> {
    if (!this.isConnected) return;
    await this.hubConnection!.invoke('SubmitDrawing', roomId, base64Image);
  }

  public async rateDrawingAsync(roomId: string, score: number): Promise<void> {
    if (!this.isConnected) return;
    await this.hubConnection!.invoke('RateDrawing', roomId, score);
  }

  public async syncDrawingAsync(roomId: string, base64Image: string): Promise<void> {
    if (!this.isConnected) return;
    await this.hubConnection!.invoke('SyncDrawing', roomId, base64Image);
  }
}

export const gameSignalrService = new GameSignalRService();