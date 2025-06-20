import { JSONSchema7 } from 'json-schema';
import { v4 } from 'uuid';

const isNotEmpty = (...propertyNames: string[]): JSONSchema7 => {
  const properties = {};
  propertyNames.forEach(
    (property) =>
      (properties[property] = {
        minLength: 1,
        description: `The "${property}" cannot be empty`,
      }),
  );
  return {
    if: {
      propertyNames: {
        enum: [...propertyNames],
      },
    },
    then: { properties },
  };
};

export const evolutionBotSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    enabled: { type: 'boolean' },
    description: { type: 'string' },
    apiUrl: { type: 'string' },
    apiKey: { type: 'string' },
    triggerType: { type: 'string', enum: ['all', 'keyword', 'none', 'advanced'] },
    triggerOperator: { type: 'string', enum: ['equals', 'contains', 'startsWith', 'endsWith', 'regex'] },
    triggerValue: { type: 'string' },
    expire: { type: 'integer' },
    keywordFinish: { type: 'string' },
    delayMessage: { type: 'integer' },
    unknownMessage: { type: 'string' },
    listeningFromMe: { type: 'boolean' },
    stopBotFromMe: { type: 'boolean' },
    keepOpen: { type: 'boolean' },
    debounceTime: { type: 'integer' },
    ignoreJids: { type: 'array', items: { type: 'string' } },
    splitMessages: { type: 'boolean' },
    timePerChar: { type: 'integer' },
  },
  required: ['enabled', 'apiUrl', 'triggerType'],
  ...isNotEmpty('enabled', 'apiUrl', 'triggerType'),
};

export const evolutionBotStatusSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    remoteJid: { type: 'string' },
    status: { type: 'string', enum: ['opened', 'closed', 'paused', 'delete'] },
  },
  required: ['remoteJid', 'status'],
  ...isNotEmpty('remoteJid', 'status'),
};

export const evolutionBotSettingSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    expire: { type: 'integer' },
    keywordFinish: { type: 'string' },
    delayMessage: { type: 'integer' },
    unknownMessage: { type: 'string' },
    listeningFromMe: { type: 'boolean' },
    stopBotFromMe: { type: 'boolean' },
    keepOpen: { type: 'boolean' },
    debounceTime: { type: 'integer' },
    ignoreJids: { type: 'array', items: { type: 'string' } },
    botIdFallback: { type: 'string' },
    splitMessages: { type: 'boolean' },
    timePerChar: { type: 'integer' },
  },
  required: [
    'expire',
    'keywordFinish',
    'delayMessage',
    'unknownMessage',
    'listeningFromMe',
    'stopBotFromMe',
    'keepOpen',
    'debounceTime',
    'ignoreJids',
    'splitMessages',
    'timePerChar',
  ],
  ...isNotEmpty(
    'expire',
    'keywordFinish',
    'delayMessage',
    'unknownMessage',
    'listeningFromMe',
    'stopBotFromMe',
    'keepOpen',
    'debounceTime',
    'ignoreJids',
    'splitMessages',
    'timePerChar',
  ),
};

export const evolutionBotIgnoreJidSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    remoteJid: { type: 'string' },
    action: { type: 'string', enum: ['add', 'remove'] },
  },
  required: ['remoteJid', 'action'],
  ...isNotEmpty('remoteJid', 'action'),
};

export const evolutionBotManualInvokeSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    evolutionBotId: { type: 'string' },
    message: {
      type: 'object',
      properties: {
        key: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            remoteJid: { type: 'string' },
            fromMe: { type: 'boolean' },
            participant: { type: 'string' },
          },
          required: ['remoteJid', 'fromMe'], // id is now optional
        },
        message: { type: 'object' },
        messageType: { type: 'string' },
        messageTimestamp: { type: 'number' },
        pushName: { type: 'string' },
        quoted: {
          type: 'object',
          properties: {
            stanzaId: { type: 'string' },
            participant: { type: 'string' },
            quotedMessage: { type: 'object' },
            mentionedJid: { type: 'array', items: { type: 'string' } },
            externalAdReply: { type: 'object' },
            forwardingScore: { type: 'number' },
            isForwarded: { type: 'boolean' },
            quotedAd: { type: 'object' },
            placeholderKey: { type: 'object' },
            expiration: { type: 'number' },
            ephemeralSettingTimestamp: { type: ['number', 'string'] }, // Accept both number and string
            ephemeralSharedSecret: { type: 'string' },
            businessMessageForwardInfo: { type: 'object' },
            businessMessageBusinessOwnerJid: { type: 'string' },
            mediaData: { type: 'object' },
            photoChange: { type: 'object' },
            userReceipt: { type: 'object' },
            reactions: { type: 'array', items: { type: 'object' } },
            quotedStickerData: { type: 'object' },
            disappearingMode: { type: 'object' },
            actionLink: { type: 'object' },
            groupSubject: { type: 'string' },
            parentGroupJid: { type: 'string' },
            trustBannerType: { type: 'string' },
            trustBannerAction: { type: 'number' },
            isSampled: { type: 'boolean' },
            utm: { type: 'object' },
            forwardedNewsletterMessageInfo: { type: 'object' },
            businessMessageBusinessOwnerJid2: { type: 'string' },
            messageSecret: { type: 'string' },
          },
        },
        mentions: { type: 'array', items: { type: 'string' } },
      },
      required: ['key', 'message', 'messageType', 'messageTimestamp'],
    },
  },
  required: ['evolutionBotId', 'message'],
  ...isNotEmpty('evolutionBotId', 'message'),
};
