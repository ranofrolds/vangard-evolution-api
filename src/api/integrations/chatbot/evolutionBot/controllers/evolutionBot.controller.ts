import { IgnoreJidDto } from '@api/dto/chatbot.dto';
import { InstanceDto } from '@api/dto/instance.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Logger } from '@config/logger.config';
import { EvolutionBot } from '@prisma/client';
import { getConversationMessage } from '@utils/getConversationMessage';

import { ChatbotController, ChatbotControllerInterface, EmitData } from '../../chatbot.controller';
import { EvolutionBotDto } from '../dto/evolutionBot.dto';
import { EvolutionBotService } from '../services/evolutionBot.service';

export class EvolutionBotController extends ChatbotController implements ChatbotControllerInterface {
  constructor(
    private readonly evolutionBotService: EvolutionBotService,
    prismaRepository: PrismaRepository,
    waMonitor: WAMonitoringService,
  ) {
    super(prismaRepository, waMonitor);

    this.botRepository = this.prismaRepository.evolutionBot;
    this.settingsRepository = this.prismaRepository.evolutionBotSetting;
    this.sessionRepository = this.prismaRepository.integrationSession;
  }

  public readonly logger = new Logger('EvolutionBotController');

  integrationEnabled: boolean;
  botRepository: any;
  settingsRepository: any;
  sessionRepository: any;
  userMessageDebounce: { [key: string]: { message: string; timeoutId: NodeJS.Timeout } } = {};

  // Bots
  public async createBot(instance: InstanceDto, data: EvolutionBotDto) {
    const instanceId = await this.prismaRepository.instance
      .findFirst({
        where: {
          name: instance.instanceName,
        },
      })
      .then((instance) => instance.id);

    if (
      !data.expire ||
      !data.keywordFinish ||
      !data.delayMessage ||
      !data.unknownMessage ||
      !data.listeningFromMe ||
      !data.stopBotFromMe ||
      !data.keepOpen ||
      !data.debounceTime ||
      !data.ignoreJids ||
      !data.splitMessages ||
      !data.timePerChar
    ) {
      const defaultSettingCheck = await this.settingsRepository.findFirst({
        where: {
          instanceId: instanceId,
        },
      });

      if (data.expire === undefined || data.expire === null) data.expire = defaultSettingCheck.expire;
      if (data.keywordFinish === undefined || data.keywordFinish === null)
        data.keywordFinish = defaultSettingCheck.keywordFinish;
      if (data.delayMessage === undefined || data.delayMessage === null)
        data.delayMessage = defaultSettingCheck.delayMessage;
      if (data.unknownMessage === undefined || data.unknownMessage === null)
        data.unknownMessage = defaultSettingCheck.unknownMessage;
      if (data.listeningFromMe === undefined || data.listeningFromMe === null)
        data.listeningFromMe = defaultSettingCheck.listeningFromMe;
      if (data.stopBotFromMe === undefined || data.stopBotFromMe === null)
        data.stopBotFromMe = defaultSettingCheck.stopBotFromMe;
      if (data.keepOpen === undefined || data.keepOpen === null) data.keepOpen = defaultSettingCheck.keepOpen;
      if (data.debounceTime === undefined || data.debounceTime === null)
        data.debounceTime = defaultSettingCheck.debounceTime;
      if (data.ignoreJids === undefined || data.ignoreJids === null) data.ignoreJids = defaultSettingCheck.ignoreJids;
      if (data.splitMessages === undefined || data.splitMessages === null)
        data.splitMessages = defaultSettingCheck?.splitMessages ?? false;
      if (data.timePerChar === undefined || data.timePerChar === null)
        data.timePerChar = defaultSettingCheck?.timePerChar ?? 0;

      if (!defaultSettingCheck) {
        await this.settings(instance, {
          expire: data.expire,
          keywordFinish: data.keywordFinish,
          delayMessage: data.delayMessage,
          unknownMessage: data.unknownMessage,
          listeningFromMe: data.listeningFromMe,
          stopBotFromMe: data.stopBotFromMe,
          keepOpen: data.keepOpen,
          debounceTime: data.debounceTime,
          ignoreJids: data.ignoreJids,
          splitMessages: data.splitMessages,
          timePerChar: data.timePerChar,
        });
      }
    }

    const checkTriggerAll = await this.botRepository.findFirst({
      where: {
        enabled: true,
        triggerType: 'all',
        instanceId: instanceId,
      },
    });

    if (checkTriggerAll && data.triggerType === 'all') {
      throw new Error('You already have a dify with an "All" trigger, you cannot have more bots while it is active');
    }

    const checkDuplicate = await this.botRepository.findFirst({
      where: {
        instanceId: instanceId,
        apiUrl: data.apiUrl,
        apiKey: data.apiKey,
      },
    });

    if (checkDuplicate) {
      throw new Error('Dify already exists');
    }

    if (data.triggerType === 'keyword') {
      if (!data.triggerOperator || !data.triggerValue) {
        throw new Error('Trigger operator and value are required');
      }

      const checkDuplicate = await this.botRepository.findFirst({
        where: {
          triggerOperator: data.triggerOperator,
          triggerValue: data.triggerValue,
          instanceId: instanceId,
        },
      });

      if (checkDuplicate) {
        throw new Error('Trigger already exists');
      }
    }

    if (data.triggerType === 'advanced') {
      if (!data.triggerValue) {
        throw new Error('Trigger value is required');
      }

      const checkDuplicate = await this.botRepository.findFirst({
        where: {
          triggerValue: data.triggerValue,
          instanceId: instanceId,
        },
      });

      if (checkDuplicate) {
        throw new Error('Trigger already exists');
      }
    }

    try {
      const bot = await this.botRepository.create({
        data: {
          enabled: data?.enabled,
          description: data.description,
          apiUrl: data.apiUrl,
          apiKey: data.apiKey,
          expire: data.expire,
          keywordFinish: data.keywordFinish,
          delayMessage: data.delayMessage,
          unknownMessage: data.unknownMessage,
          listeningFromMe: data.listeningFromMe,
          stopBotFromMe: data.stopBotFromMe,
          keepOpen: data.keepOpen,
          debounceTime: data.debounceTime,
          instanceId: instanceId,
          triggerType: data.triggerType,
          triggerOperator: data.triggerOperator,
          triggerValue: data.triggerValue,
          ignoreJids: data.ignoreJids,
          splitMessages: data.splitMessages,
          timePerChar: data.timePerChar,
        },
      });

      return bot;
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error creating bot');
    }
  }

  public async findBot(instance: InstanceDto) {
    const instanceId = await this.prismaRepository.instance
      .findFirst({
        where: {
          name: instance.instanceName,
        },
      })
      .then((instance) => instance.id);

    const bots = await this.botRepository.findMany({
      where: {
        instanceId: instanceId,
      },
    });

    if (!bots.length) {
      return null;
    }

    return bots;
  }

  public async fetchBot(instance: InstanceDto, botId: string) {
    const instanceId = await this.prismaRepository.instance
      .findFirst({
        where: {
          name: instance.instanceName,
        },
      })
      .then((instance) => instance.id);

    const bot = await this.botRepository.findFirst({
      where: {
        id: botId,
      },
    });

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.instanceId !== instanceId) {
      throw new Error('Bot not found');
    }

    return bot;
  }

  public async updateBot(instance: InstanceDto, botId: string, data: EvolutionBotDto) {
    const instanceId = await this.prismaRepository.instance
      .findFirst({
        where: {
          name: instance.instanceName,
        },
      })
      .then((instance) => instance.id);

    const bot = await this.botRepository.findFirst({
      where: {
        id: botId,
      },
    });

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.instanceId !== instanceId) {
      throw new Error('Bot not found');
    }

    if (data.triggerType === 'all') {
      const checkTriggerAll = await this.botRepository.findFirst({
        where: {
          enabled: true,
          triggerType: 'all',
          id: {
            not: botId,
          },
          instanceId: instanceId,
        },
      });

      if (checkTriggerAll) {
        throw new Error('You already have a bot with an "All" trigger, you cannot have more bots while it is active');
      }
    }

    const checkDuplicate = await this.botRepository.findFirst({
      where: {
        id: {
          not: botId,
        },
        instanceId: instanceId,
        apiUrl: data.apiUrl,
        apiKey: data.apiKey,
      },
    });

    if (checkDuplicate) {
      throw new Error('Bot already exists');
    }

    if (data.triggerType === 'keyword') {
      if (!data.triggerOperator || !data.triggerValue) {
        throw new Error('Trigger operator and value are required');
      }

      const checkDuplicate = await this.botRepository.findFirst({
        where: {
          triggerOperator: data.triggerOperator,
          triggerValue: data.triggerValue,
          id: { not: botId },
          instanceId: instanceId,
        },
      });

      if (checkDuplicate) {
        throw new Error('Trigger already exists');
      }
    }

    if (data.triggerType === 'advanced') {
      if (!data.triggerValue) {
        throw new Error('Trigger value is required');
      }

      const checkDuplicate = await this.botRepository.findFirst({
        where: {
          triggerValue: data.triggerValue,
          id: { not: botId },
          instanceId: instanceId,
        },
      });

      if (checkDuplicate) {
        throw new Error('Trigger already exists');
      }
    }

    try {
      const bot = await this.botRepository.update({
        where: {
          id: botId,
        },
        data: {
          enabled: data?.enabled,
          description: data.description,
          apiUrl: data.apiUrl,
          apiKey: data.apiKey,
          expire: data.expire,
          keywordFinish: data.keywordFinish,
          delayMessage: data.delayMessage,
          unknownMessage: data.unknownMessage,
          listeningFromMe: data.listeningFromMe,
          stopBotFromMe: data.stopBotFromMe,
          keepOpen: data.keepOpen,
          debounceTime: data.debounceTime,
          instanceId: instanceId,
          triggerType: data.triggerType,
          triggerOperator: data.triggerOperator,
          triggerValue: data.triggerValue,
          ignoreJids: data.ignoreJids,
          splitMessages: data.splitMessages,
          timePerChar: data.timePerChar,
        },
      });

      return bot;
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error updating bot');
    }
  }

  public async deleteBot(instance: InstanceDto, botId: string) {
    const instanceId = await this.prismaRepository.instance
      .findFirst({
        where: {
          name: instance.instanceName,
        },
      })
      .then((instance) => instance.id);

    const bot = await this.botRepository.findFirst({
      where: {
        id: botId,
      },
    });

    if (!bot) {
      throw new Error('Bot not found');
    }

    if (bot.instanceId !== instanceId) {
      throw new Error('Bot not found');
    }
    try {
      await this.prismaRepository.integrationSession.deleteMany({
        where: {
          botId: botId,
        },
      });

      await this.botRepository.delete({
        where: {
          id: botId,
        },
      });

      return { bot: { id: botId } };
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error deleting bot');
    }
  }

  // Settings
  public async settings(instance: InstanceDto, data: any) {
    try {
      const instanceId = await this.prismaRepository.instance
        .findFirst({
          where: {
            name: instance.instanceName,
          },
        })
        .then((instance) => instance.id);

      const settings = await this.settingsRepository.findFirst({
        where: {
          instanceId: instanceId,
        },
      });

      if (settings) {
        const updateSettings = await this.settingsRepository.update({
          where: {
            id: settings.id,
          },
          data: {
            expire: data.expire,
            keywordFinish: data.keywordFinish,
            delayMessage: data.delayMessage,
            unknownMessage: data.unknownMessage,
            listeningFromMe: data.listeningFromMe,
            stopBotFromMe: data.stopBotFromMe,
            keepOpen: data.keepOpen,
            debounceTime: data.debounceTime,
            botIdFallback: data.botIdFallback,
            ignoreJids: data.ignoreJids,
            splitMessages: data.splitMessages,
            timePerChar: data.timePerChar,
          },
        });

        return {
          expire: updateSettings.expire,
          keywordFinish: updateSettings.keywordFinish,
          delayMessage: updateSettings.delayMessage,
          unknownMessage: updateSettings.unknownMessage,
          listeningFromMe: updateSettings.listeningFromMe,
          stopBotFromMe: updateSettings.stopBotFromMe,
          keepOpen: updateSettings.keepOpen,
          debounceTime: updateSettings.debounceTime,
          botIdFallback: updateSettings.botIdFallback,
          ignoreJids: updateSettings.ignoreJids,
          splitMessages: updateSettings.splitMessages,
          timePerChar: updateSettings.timePerChar,
        };
      }

      const newSetttings = await this.settingsRepository.create({
        data: {
          expire: data.expire,
          keywordFinish: data.keywordFinish,
          delayMessage: data.delayMessage,
          unknownMessage: data.unknownMessage,
          listeningFromMe: data.listeningFromMe,
          stopBotFromMe: data.stopBotFromMe,
          keepOpen: data.keepOpen,
          debounceTime: data.debounceTime,
          botIdFallback: data.botIdFallback,
          ignoreJids: data.ignoreJids,
          splitMessages: data.splitMessages,
          timePerChar: data.timePerChar,
          instanceId: instanceId,
        },
      });

      return {
        expire: newSetttings.expire,
        keywordFinish: newSetttings.keywordFinish,
        delayMessage: newSetttings.delayMessage,
        unknownMessage: newSetttings.unknownMessage,
        listeningFromMe: newSetttings.listeningFromMe,
        stopBotFromMe: newSetttings.stopBotFromMe,
        keepOpen: newSetttings.keepOpen,
        debounceTime: newSetttings.debounceTime,
        botIdFallback: newSetttings.botIdFallback,
        ignoreJids: newSetttings.ignoreJids,
        splitMessages: newSetttings.splitMessages,
        timePerChar: newSetttings.timePerChar,
      };
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error setting default settings');
    }
  }

  public async fetchSettings(instance: InstanceDto) {
    try {
      const instanceId = await this.prismaRepository.instance
        .findFirst({
          where: {
            name: instance.instanceName,
          },
        })
        .then((instance) => instance.id);

      const settings = await this.settingsRepository.findFirst({
        where: {
          instanceId: instanceId,
        },
        include: {
          Fallback: true,
        },
      });

      if (!settings) {
        return {
          expire: 0,
          keywordFinish: '',
          delayMessage: 0,
          unknownMessage: '',
          listeningFromMe: false,
          stopBotFromMe: false,
          keepOpen: false,
          ignoreJids: [],
          splitMessages: false,
          timePerChar: 0,
          botIdFallback: '',
          fallback: null,
        };
      }

      return {
        expire: settings.expire,
        keywordFinish: settings.keywordFinish,
        delayMessage: settings.delayMessage,
        unknownMessage: settings.unknownMessage,
        listeningFromMe: settings.listeningFromMe,
        stopBotFromMe: settings.stopBotFromMe,
        keepOpen: settings.keepOpen,
        ignoreJids: settings.ignoreJids,
        splitMessages: settings.splitMessages,
        timePerChar: settings.timePerChar,
        botIdFallback: settings.botIdFallback,
        fallback: settings.Fallback,
      };
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error fetching default settings');
    }
  }

  // Sessions
  public async changeStatus(instance: InstanceDto, data: any) {
    try {
      const instanceId = await this.prismaRepository.instance
        .findFirst({
          where: {
            name: instance.instanceName,
          },
        })
        .then((instance) => instance.id);

      const defaultSettingCheck = await this.settingsRepository.findFirst({
        where: {
          instanceId,
        },
      });

      const remoteJid = data.remoteJid;
      const status = data.status;

      if (status === 'delete') {
        await this.sessionRepository.deleteMany({
          where: {
            remoteJid: remoteJid,
            botId: { not: null },
          },
        });

        return { bot: { remoteJid: remoteJid, status: status } };
      }

      if (status === 'closed') {
        if (defaultSettingCheck?.keepOpen) {
          await this.sessionRepository.updateMany({
            where: {
              remoteJid: remoteJid,
              botId: { not: null },
            },
            data: {
              status: 'closed',
            },
          });
        } else {
          await this.sessionRepository.deleteMany({
            where: {
              remoteJid: remoteJid,
              botId: { not: null },
            },
          });
        }

        return { bot: { ...instance, bot: { remoteJid: remoteJid, status: status } } };
      } else {
        const session = await this.sessionRepository.updateMany({
          where: {
            instanceId: instanceId,
            remoteJid: remoteJid,
            botId: { not: null },
          },
          data: {
            status: status,
          },
        });

        const botData = {
          remoteJid: remoteJid,
          status: status,
          session,
        };

        return { bot: { ...instance, bot: botData } };
      }
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error changing status');
    }
  }

  public async fetchSessions(instance: InstanceDto, botId: string, remoteJid?: string) {
    try {
      const instanceId = await this.prismaRepository.instance
        .findFirst({
          where: {
            name: instance.instanceName,
          },
        })
        .then((instance) => instance.id);

      const bot = await this.botRepository.findFirst({
        where: {
          id: botId,
        },
      });

      if (bot && bot.instanceId !== instanceId) {
        throw new Error('Dify not found');
      }

      return await this.sessionRepository.findMany({
        where: {
          instanceId: instanceId,
          remoteJid,
          botId: bot ? botId : { not: null },
          type: 'evolution',
        },
      });
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error fetching sessions');
    }
  }

  public async ignoreJid(instance: InstanceDto, data: IgnoreJidDto) {
    try {
      const instanceId = await this.prismaRepository.instance
        .findFirst({
          where: {
            name: instance.instanceName,
          },
        })
        .then((instance) => instance.id);

      const settings = await this.settingsRepository.findFirst({
        where: {
          instanceId: instanceId,
        },
      });

      if (!settings) {
        throw new Error('Settings not found');
      }

      let ignoreJids: any = settings?.ignoreJids || [];

      if (data.action === 'add') {
        if (ignoreJids.includes(data.remoteJid)) return { ignoreJids: ignoreJids };

        ignoreJids.push(data.remoteJid);
      } else {
        ignoreJids = ignoreJids.filter((jid) => jid !== data.remoteJid);
      }

      const updateSettings = await this.settingsRepository.update({
        where: {
          id: settings.id,
        },
        data: {
          ignoreJids: ignoreJids,
        },
      });

      return {
        ignoreJids: updateSettings.ignoreJids,
      };
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error setting default settings');
    }
  }

  // Emit
  public async emit({ instance, remoteJid, msg }: EmitData) {
    try {
      const settings = await this.settingsRepository.findFirst({
        where: {
          instanceId: instance.instanceId,
        },
      });

      if (this.checkIgnoreJids(settings?.ignoreJids, remoteJid)) return;

      const session = await this.getSession(remoteJid, instance);

      const content = getConversationMessage(msg);

      let findBot = (await this.findBotTrigger(this.botRepository, content, instance, session)) as EvolutionBot;

      if (!findBot) {
        const fallback = await this.settingsRepository.findFirst({
          where: {
            instanceId: instance.instanceId,
          },
        });

        if (fallback?.botIdFallback) {
          const findFallback = await this.botRepository.findFirst({
            where: {
              id: fallback.botIdFallback,
            },
          });

          findBot = findFallback;
        } else {
          return;
        }
      }

      let expire = findBot?.expire;
      let keywordFinish = findBot?.keywordFinish;
      let delayMessage = findBot?.delayMessage;
      let unknownMessage = findBot?.unknownMessage;
      let listeningFromMe = findBot?.listeningFromMe;
      let stopBotFromMe = findBot?.stopBotFromMe;
      let keepOpen = findBot?.keepOpen;
      let debounceTime = findBot?.debounceTime;
      let ignoreJids = findBot?.ignoreJids;
      let splitMessages = findBot?.splitMessages;
      let timePerChar = findBot?.timePerChar;

      if (expire === undefined || expire === null) expire = settings.expire;
      if (keywordFinish === undefined || keywordFinish === null) keywordFinish = settings.keywordFinish;
      if (delayMessage === undefined || delayMessage === null) delayMessage = settings.delayMessage;
      if (unknownMessage === undefined || unknownMessage === null) unknownMessage = settings.unknownMessage;
      if (listeningFromMe === undefined || listeningFromMe === null) listeningFromMe = settings.listeningFromMe;
      if (stopBotFromMe === undefined || stopBotFromMe === null) stopBotFromMe = settings.stopBotFromMe;
      if (keepOpen === undefined || keepOpen === null) keepOpen = settings.keepOpen;
      if (debounceTime === undefined || debounceTime === null) debounceTime = settings.debounceTime;
      if (ignoreJids === undefined || ignoreJids === null) ignoreJids = settings.ignoreJids;
      if (splitMessages === undefined || splitMessages === null) splitMessages = settings?.splitMessages ?? false;
      if (timePerChar === undefined || timePerChar === null) timePerChar = settings?.timePerChar ?? 0;

      const key = msg.key as {
        id: string;
        remoteJid: string;
        fromMe: boolean;
        participant: string;
      };

      if (stopBotFromMe && key.fromMe && session) {
        await this.prismaRepository.integrationSession.update({
          where: {
            id: session.id,
          },
          data: {
            status: 'paused',
          },
        });
        return;
      }

      if (!listeningFromMe && key.fromMe) {
        return;
      }

      if (session && !session.awaitUser) {
        return;
      }

      if (debounceTime && debounceTime > 0) {
        this.processDebounce(this.userMessageDebounce, content, remoteJid, debounceTime, async (debouncedContent) => {
          await this.evolutionBotService.processBot(
            this.waMonitor.waInstances[instance.instanceName],
            remoteJid,
            findBot,
            session,
            {
              ...settings,
              expire,
              keywordFinish,
              delayMessage,
              unknownMessage,
              listeningFromMe,
              stopBotFromMe,
              keepOpen,
              debounceTime,
              ignoreJids,
              splitMessages,
              timePerChar,
            },
            debouncedContent,
            msg?.pushName,
            null,
          );
        });
      } else {
        await this.evolutionBotService.processBot(
          this.waMonitor.waInstances[instance.instanceName],
          remoteJid,
          findBot,
          session,
          {
            ...settings,
            expire,
            keywordFinish,
            delayMessage,
            unknownMessage,
            listeningFromMe,
            stopBotFromMe,
            keepOpen,
            debounceTime,
            ignoreJids,
            splitMessages,
            timePerChar,
          },
          content,
          msg?.pushName,
          null,
        );
      }

      return;
    } catch (error) {
      this.logger.error(error);
      return;
    }
  }

  // Manual Invoke
  public async manualInvoke(instance: InstanceDto, data: any) {
    try {
      const { evolutionBotId, message } = data;

      // Auto-generate ID if not provided
      if (!message.key.id) {
        message.key.id = 'manual-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      }

      // Get bot settings
      const settings = await this.settingsRepository.findFirst({
        where: {
          instanceId: instance.instanceId,
        },
      });

      if (!settings) {
        throw new Error('Evolution Bot settings not found for this instance');
      }

      // Get message content
      const content = getConversationMessage(message);

      // Extract contextInfo if available
      const contextInfo = message.contextInfo || message.quoted || null;

      // Check ignore JIDs
      if (this.checkIgnoreJids(settings?.ignoreJids, message.key.remoteJid)) {
        return { message: 'JID is in ignore list' };
      }

      // Get the specific bot by ID first
      const specificBot = await this.botRepository.findFirst({
        where: {
          id: evolutionBotId,
          enabled: true,
          instanceId: instance.instanceId,
        },
      });

      if (!specificBot) {
        throw new Error(`Evolution Bot with ID ${evolutionBotId} not found or not enabled`);
      }

      // Check if there's already a session for this specific bot
      const existingSession = await this.prismaRepository.integrationSession.findFirst({
        where: {
          remoteJid: message.key.remoteJid,
          instanceId: instance.instanceId,
          botId: evolutionBotId,
          status: { not: 'closed' },
        },
        orderBy: { createdAt: 'desc' },
      });

      const bot = specificBot;
      let shouldExecute = false;

      if (existingSession) {
        // If session exists for this bot, proceed normally
        shouldExecute = true;
        this.logger.log(`Found existing session for bot ${evolutionBotId}, proceeding with execution`);
      } else {
        // No session exists, check if this is a finishing trigger
        if (specificBot.keywordFinish && content === specificBot.keywordFinish) {
          return {
            message: `Bot with ID ${evolutionBotId} received finish keyword but no active session exists`,
            botId: evolutionBotId,
            keywordFinish: specificBot.keywordFinish,
            messageContent: content,
            sessionExists: false,
          };
        }

        // No session exists, check if trigger is activated to start new session
        if (specificBot.triggerType === 'all') {
          shouldExecute = true;
        } else if (specificBot.triggerType === 'keyword') {
          const { triggerOperator, triggerValue } = specificBot;

          switch (triggerOperator) {
            case 'equals':
              shouldExecute = content === triggerValue;
              break;
            case 'contains':
              shouldExecute = content.includes(triggerValue);
              break;
            case 'startsWith':
              shouldExecute = content.startsWith(triggerValue);
              break;
            case 'endsWith':
              shouldExecute = content.endsWith(triggerValue);
              break;
            case 'regex':
              try {
                const regex = new RegExp(triggerValue);
                shouldExecute = regex.test(content);
              } catch (e) {
                this.logger.error(`Invalid regex pattern: ${triggerValue}`);
                shouldExecute = false;
              }
              break;
          }
        } else if (specificBot.triggerType === 'advanced') {
          const { advancedOperatorsSearch } = await import('@utils/advancedOperatorsSearch');
          shouldExecute = advancedOperatorsSearch(content, specificBot.triggerValue);
        }

        if (!shouldExecute) {
          return {
            message: `Bot with ID ${evolutionBotId} exists but trigger conditions not met for new session`,
            botId: evolutionBotId,
            triggerType: specificBot.triggerType,
            triggerOperator: specificBot.triggerOperator,
            triggerValue: specificBot.triggerValue,
            messageContent: content,
            sessionExists: false,
            triggered: false,
          };
        }
      }

      // Update session reference
      const session = existingSession;

      // Prepare settings with bot specific values or fallback to general settings
      let expire = bot?.expire;
      let keywordFinish = bot?.keywordFinish;
      let delayMessage = bot?.delayMessage;
      let unknownMessage = bot?.unknownMessage;
      let listeningFromMe = bot?.listeningFromMe;
      let stopBotFromMe = bot?.stopBotFromMe;
      let keepOpen = bot?.keepOpen;
      let debounceTime = bot?.debounceTime;
      let ignoreJids = bot?.ignoreJids;
      let splitMessages = bot?.splitMessages;
      let timePerChar = bot?.timePerChar;

      if (expire === undefined || expire === null) expire = settings.expire;
      if (keywordFinish === undefined || keywordFinish === null) keywordFinish = settings.keywordFinish;
      if (delayMessage === undefined || delayMessage === null) delayMessage = settings.delayMessage;
      if (unknownMessage === undefined || unknownMessage === null) unknownMessage = settings.unknownMessage;
      if (listeningFromMe === undefined || listeningFromMe === null) listeningFromMe = settings.listeningFromMe;
      if (stopBotFromMe === undefined || stopBotFromMe === null) stopBotFromMe = settings.stopBotFromMe;
      if (keepOpen === undefined || keepOpen === null) keepOpen = settings.keepOpen;
      if (debounceTime === undefined || debounceTime === null) debounceTime = settings.debounceTime;
      if (ignoreJids === undefined || ignoreJids === null) ignoreJids = settings.ignoreJids;
      if (splitMessages === undefined || splitMessages === null) splitMessages = settings?.splitMessages ?? false;
      if (timePerChar === undefined || timePerChar === null) timePerChar = settings?.timePerChar ?? 0;

      // Check if should stop bot from own messages
      if (stopBotFromMe && message.key.fromMe && session) {
        await this.prismaRepository.integrationSession.update({
          where: {
            id: session.id,
          },
          data: {
            status: 'paused',
          },
        });
        return { message: 'Bot stopped due to message from me' };
      }

      // Check if should listen to own messages
      if (!listeningFromMe && message.key.fromMe) {
        return { message: 'Bot not listening to messages from me' };
      }

      // Check if session is waiting for user
      if (session && !session.awaitUser) {
        return { message: 'Session not awaiting user response' };
      }

      // Check if session is paused
      if (session && session.status === 'paused') {
        return { message: 'Session is paused' };
      }

      // Process the bot with debounce or directly
      if (debounceTime && debounceTime > 0) {
        this.processDebounce(
          this.userMessageDebounce,
          content,
          message.key.remoteJid,
          debounceTime,
          async (debouncedContent) => {
            await this.evolutionBotService.processBot(
              this.waMonitor.waInstances[instance.instanceName],
              message.key.remoteJid,
              bot,
              session,
              {
                ...settings,
                expire,
                keywordFinish,
                delayMessage,
                unknownMessage,
                listeningFromMe,
                stopBotFromMe,
                keepOpen,
                debounceTime,
                ignoreJids,
                splitMessages,
                timePerChar,
              },
              debouncedContent,
              message?.pushName,
              contextInfo,
            );
          },
        );
      } else {
        await this.evolutionBotService.processBot(
          this.waMonitor.waInstances[instance.instanceName],
          message.key.remoteJid,
          bot,
          session,
          {
            ...settings,
            expire,
            keywordFinish,
            delayMessage,
            unknownMessage,
            listeningFromMe,
            stopBotFromMe,
            keepOpen,
            debounceTime,
            ignoreJids,
            splitMessages,
            timePerChar,
          },
          content,
          message?.pushName,
          contextInfo,
        );
      }

      return {
        message: 'Evolution Bot invoked successfully',
        botId: bot.id,
        botTriggered: true,
        triggerType: bot.triggerType,
        remoteJid: message.key.remoteJid,
        content: content,
      };
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
}
