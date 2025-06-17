import { TriggerOperator, TriggerType } from '@prisma/client';

export class EvolutionBotDto {
  enabled?: boolean;
  description?: string;
  apiUrl?: string;
  apiKey?: string;
  expire?: number;
  keywordFinish?: string;
  delayMessage?: number;
  unknownMessage?: string;
  listeningFromMe?: boolean;
  stopBotFromMe?: boolean;
  keepOpen?: boolean;
  debounceTime?: number;
  triggerType?: TriggerType;
  triggerOperator?: TriggerOperator;
  triggerValue?: string;
  ignoreJids?: any;
  splitMessages?: boolean;
  timePerChar?: number;
}

export class EvolutionBotSettingDto {
  expire?: number;
  keywordFinish?: string;
  delayMessage?: number;
  unknownMessage?: string;
  listeningFromMe?: boolean;
  stopBotFromMe?: boolean;
  keepOpen?: boolean;
  debounceTime?: number;
  botIdFallback?: string;
  ignoreJids?: any;
  splitMessages?: boolean;
  timePerChar?: number;
}

export class EvolutionBotManualInvokeDto {
  evolutionBotId: string;
  message: {
    key: {
      id?: string; // Optional - will be auto-generated if not provided
      remoteJid: string;
      fromMe: boolean;
      participant?: string;
    };
    message: any;
    messageType: string;
    messageTimestamp: number;
    pushName?: string;
    quoted?: any;
    mentions?: string[];
  };
}
