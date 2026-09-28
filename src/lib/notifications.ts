import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, supabaseConfigured } from './supabase';

const MESSAGES_CHANNEL = 'messages';
const ANDROID_IMPORTANCE_HIGH = 6;

const isAndroidExpoGo = Platform.OS === 'android' && Constants.appOwnership === 'expo';

type NotificationLike = {
  request: {
    content: {
      data?: Record<string, unknown>;
    };
  };
};

type NotificationSub = { remove: () => void };

type LocalNotificationsApi = {
  setNotificationHandler: (handler: {
    handleNotification: (notification: NotificationLike) => Promise<{
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
      shouldShowBanner: boolean;
      shouldShowList: boolean;
    }>;
  }) => void;
  scheduleNotificationAsync: (request: unknown) => Promise<string>;
  setNotificationChannelAsync: (id: string, channel: Record<string, unknown>) => Promise<unknown>;
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getLastNotificationResponse: () => { notification: NotificationLike } | null;
  addNotificationResponseReceivedListener: (
    listener: (response: { notification: NotificationLike }) => void,
  ) => NotificationSub;
  clearLastNotificationResponse: () => void;
};

function loadLocalApi(): LocalNotificationsApi | null {
  if (Platform.OS === 'web') return null;
  try {
    // Importa arquivos internos: o barrel `expo-notifications` executa
    // DevicePushTokenAutoRegistration.fx e isso lança no Expo Go Android.
    const Handler = require('expo-notifications/build/NotificationsHandler') as {
      setNotificationHandler: LocalNotificationsApi['setNotificationHandler'];
    };
    const Scheduler = require('expo-notifications/build/scheduleNotificationAsync') as {
      scheduleNotificationAsync: LocalNotificationsApi['scheduleNotificationAsync'];
    };
    const Channels = require('expo-notifications/build/setNotificationChannelAsync') as {
      setNotificationChannelAsync: LocalNotificationsApi['setNotificationChannelAsync'];
    };
    const Perms = require('expo-notifications/build/NotificationPermissions') as {
      getPermissionsAsync: LocalNotificationsApi['getPermissionsAsync'];
      requestPermissionsAsync: LocalNotificationsApi['requestPermissionsAsync'];
    };
    const Emitter = require('expo-notifications/build/NotificationsEmitter') as {
      getLastNotificationResponse: LocalNotificationsApi['getLastNotificationResponse'];
      addNotificationResponseReceivedListener: LocalNotificationsApi['addNotificationResponseReceivedListener'];
      clearLastNotificationResponse: LocalNotificationsApi['clearLastNotificationResponse'];
    };
    return {
      setNotificationHandler: Handler.setNotificationHandler,
      scheduleNotificationAsync: Scheduler.scheduleNotificationAsync,
      setNotificationChannelAsync: Channels.setNotificationChannelAsync,
      getPermissionsAsync: Perms.getPermissionsAsync,
      requestPermissionsAsync: Perms.requestPermissionsAsync,
      getLastNotificationResponse: Emitter.getLastNotificationResponse,
      addNotificationResponseReceivedListener: Emitter.addNotificationResponseReceivedListener,
      clearLastNotificationResponse: Emitter.clearLastNotificationResponse,
    };
  } catch (e) {
    if (__DEV__) console.warn('[Resenha] Notificações locais indisponíveis', e);
    return null;
  }
}

const api = loadLocalApi();

let activeConversationId: string | null = null;
let expoPushToken: string | null = null;
let handlerReady = false;

export function setActiveConversationId(id: string | null) {
  activeConversationId = id;
}

export function getActiveConversationId() {
  return activeConversationId;
}

export function hasExpoPushToken() {
  return Boolean(expoPushToken);
}

function ensureHandler() {
  if (handlerReady || !api) return;
  handlerReady = true;
  api.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data ?? {};
      const conversationId =
        typeof data.conversationId === 'string' ? data.conversationId : null;
      const inThread = Boolean(conversationId && conversationId === activeConversationId);
      const isLocal = data.local === true;
      const appActive = AppState.currentState === 'active';
      if (!isLocal && appActive) {
        return {
          shouldPlaySound: false,
          shouldSetBadge: true,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }
      return {
        shouldPlaySound: !inThread,
        shouldSetBadge: true,
        shouldShowBanner: !inThread,
        shouldShowList: !inThread,
      };
    },
  });
}

ensureHandler();

function chatUrl(conversationId: string) {
  return `/(app)/chat/${conversationId}`;
}

export function conversationIdFromNotification(notification: NotificationLike): string | null {
  const data = notification.request.content.data ?? {};
  if (typeof data.conversationId === 'string' && data.conversationId) {
    return data.conversationId;
  }
  if (typeof data.url === 'string') {
    const match = data.url.match(/chat\/([^/?]+)/);
    return match?.[1] ?? null;
  }
  return null;
}

async function ensureAndroidChannel() {
  // Expo Go Android não tem NotificationsChannelsProvider — o canal nativo lança NPE.
  if (Platform.OS !== 'android' || !api || isAndroidExpoGo) return;
  try {
    await api.setNotificationChannelAsync(MESSAGES_CHANNEL, {
      name: 'Mensagens',
      importance: ANDROID_IMPORTANCE_HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2F6BFF',
      sound: 'default',
    });
  } catch {
    // Canal só existe em development/production build.
  }
}

export async function registerPushToken(userId: string): Promise<string | null> {
  if (Platform.OS === 'web' || !supabaseConfigured || !api) return null;
  ensureHandler();

  try {
    const existing = await api.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const asked = await api.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return null;
  } catch {
    // Permissão também pode falhar no Expo Go; o login não depende disso.
  }

  if (isAndroidExpoGo) return null;

  try {
    await ensureAndroidChannel();

    const { getExpoPushTokenAsync } = require('expo-notifications/build/getExpoPushTokenAsync') as {
      getExpoPushTokenAsync: (options?: { projectId?: string }) => Promise<{ data: string }>;
    };
    const projectId =
      Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = projectId
      ? await getExpoPushTokenAsync({ projectId })
      : await getExpoPushTokenAsync();
    expoPushToken = tokenResponse.data;
  } catch (e) {
    expoPushToken = null;
    if (__DEV__) {
      console.warn('[Resenha] Push remoto indisponível neste ambiente', e);
    }
  }

  if (!expoPushToken) return null;

  const { error } = await supabase.from('push_tokens').upsert({
    token: expoPushToken,
    user_id: userId,
    updated_at: new Date().toISOString(),
  });
  if (error && !/schema cache|does not exist|relation/i.test(error.message)) {
    console.warn('[Resenha] Falha ao salvar push token', error.message);
  }
  return expoPushToken;
}

export async function unregisterPushToken() {
  if (!expoPushToken || !supabaseConfigured) {
    expoPushToken = null;
    return;
  }
  await supabase.from('push_tokens').delete().eq('token', expoPushToken).then(
    () => undefined,
    () => undefined,
  );
  expoPushToken = null;
}

export async function presentIncomingNotification(input: {
  messageId: string;
  conversationId: string;
  title: string;
  body: string;
}): Promise<void> {
  if (!api || activeConversationId === input.conversationId) return;
  ensureHandler();
  try {
    await ensureAndroidChannel();
    await api.scheduleNotificationAsync({
      identifier: input.messageId,
      content: {
        title: input.title,
        body: input.body,
        sound: 'default',
        data: {
          local: true,
          conversationId: input.conversationId,
          messageId: input.messageId,
          url: chatUrl(input.conversationId),
        },
      },
      trigger:
        Platform.OS === 'android' && !isAndroidExpoGo
          ? { channelId: MESSAGES_CHANNEL }
          : null,
    });
  } catch (e) {
    if (__DEV__) console.warn('[Resenha] Falha ao mostrar notificação', e);
  }
}

export function watchNotificationResponses(onOpen: (conversationId: string) => void): () => void {
  if (!api) return () => undefined;

  const openFrom = (notification: NotificationLike) => {
    const conversationId = conversationIdFromNotification(notification);
    if (!conversationId) return;
    api.clearLastNotificationResponse();
    onOpen(conversationId);
  };

  const last = api.getLastNotificationResponse();
  if (last?.notification) openFrom(last.notification);

  const sub = api.addNotificationResponseReceivedListener((response) => {
    openFrom(response.notification);
  });
  return () => sub.remove();
}

export async function sendExpoPushToTokens(input: {
  tokens: string[];
  title: string;
  body: string;
  conversationId: string;
  messageId: string;
}): Promise<void> {
  const tokens = [...new Set(input.tokens.filter(Boolean))];
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => ({
    to,
    title: input.title,
    body: input.body,
    sound: 'default',
    channelId: MESSAGES_CHANNEL,
    data: {
      conversationId: input.conversationId,
      messageId: input.messageId,
      url: chatUrl(input.conversationId),
    },
  }));
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    if (__DEV__) console.warn('[Resenha] Falha ao enviar push Expo', e);
  }
}
