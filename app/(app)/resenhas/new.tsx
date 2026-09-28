import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { isGoogleAuthCancelled, useAuth } from '../../../src/lib/auth';
import { listMyContacts } from '../../../src/lib/contacts';
import {
  createResenhaCalendarEvent,
  friendlyCalendarError,
  guestEmailsFromProfiles,
  isGoogleCalendarAuthError,
} from '../../../src/lib/google-calendar';
import { displayNameFor } from '../../../src/lib/invites';
import { isAbortError, searchPlaces, type PlaceSuggestion } from '../../../src/lib/places';
import { addCustomIcon, listCustomIcons } from '../../../src/lib/resenha-icons';
import { createResenha, friendlyResenhaError } from '../../../src/lib/resenhas';
import type { Profile } from '../../../src/types/profile';
import { RESENHA_ICONS, type ResenhaIconOption } from '../../../src/types/resenha';
import {
  FALLBACK_COORDS,
  ResenhaMap,
  SoftAvatar,
  SoftButton,
  SoftInput,
  useDialog,
  useGlassChrome,
} from '../../../src/soft-ui';
import { themeFromScheme } from '../../../src/soft-ui/theme';

function mergeDatePart(current: Date, next: Date) {
  const copy = new Date(current);
  copy.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  return copy;
}

function mergeTimePart(current: Date, next: Date) {
  const copy = new Date(current);
  copy.setHours(next.getHours(), next.getMinutes(), 0, 0);
  return copy;
}

function formatPlace(geo: Location.LocationGeocodedAddress | undefined): string | null {
  if (!geo) return null;
  const bits = [geo.street, geo.streetNumber, geo.district, geo.city, geo.region].filter(Boolean);
  return bits.join(', ') || geo.name || geo.formattedAddress || null;
}

export default function NewResenhaScreen() {
  const theme = themeFromScheme(useColorScheme());
  const chrome = useGlassChrome();
  const { user, ensureGoogleCalendarAccess } = useAuth();
  const router = useRouter();
  const { show } = useDialog();
  const userPickedPlace = useRef(false);
  const [name, setName] = useState('');
  const [occursAt, setOccursAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  });
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [icon, setIcon] = useState<ResenhaIconOption>(RESENHA_ICONS[0]);
  const [customIcons, setCustomIcons] = useState<ResenhaIconOption[]>([]);
  const [iconModal, setIconModal] = useState(false);
  const [newEmoji, setNewEmoji] = useState('');
  const [newIconName, setNewIconName] = useState('');
  const [savingIcon, setSavingIcon] = useState(false);
  const [coords, setCoords] = useState(FALLBACK_COORDS);
  const [cameraKey, setCameraKey] = useState(0);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const skipSuggest = useRef(false);
  const biasRef = useRef(coords);
  biasRef.current = coords;
  const [mapLocked, setMapLocked] = useState(false);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calendarPrompt, setCalendarPrompt] = useState<{
    id: string;
    name: string;
    occursAt: Date;
    latitude: number;
    longitude: number;
    placeLabel: string | null;
    guestIds: string[];
  } | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const allIcons = useMemo(() => [...customIcons, ...RESENHA_ICONS], [customIcons]);

  const refreshCustomIcons = useCallback(async () => {
    if (!user) return;
    const rows = await listCustomIcons(user.id);
    setCustomIcons(rows);
  }, [user]);

  useEffect(() => {
    void refreshCustomIcons();
  }, [refreshCustomIcons]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      try {
        const rows = await listMyContacts(user.id);
        if (alive) setContacts(rows);
      } catch {
        if (alive) setContacts([]);
      } finally {
        if (alive) setLoadingContacts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const applyCoords = useCallback(
    async (next: { latitude: number; longitude: number }, opts?: { recenter?: boolean; reverse?: boolean }) => {
      setCoords(next);
      if (opts?.recenter) setCameraKey((key) => key + 1);
      if (opts?.reverse === false) return;
      try {
        const geo = await Location.reverseGeocodeAsync(next);
        setPlaceLabel(formatPlace(geo[0]));
      } catch {
        setPlaceLabel(null);
      }
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || !alive || userPickedPlace.current) return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!alive || userPickedPlace.current) return;
        await applyCoords(
          { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
          { recenter: true },
        );
      } catch {
        // mapa fica no fallback até busca ou toque
      }
    })();
    return () => {
      alive = false;
    };
  }, [applyCoords]);

  const onPickerValue = useCallback(
    (_event: unknown, date: Date) => {
      if (Platform.OS === 'android') setPicker(null);
      setOccursAt((prev) => (picker === 'time' ? mergeTimePart(prev, date) : mergeDatePart(prev, date)));
    },
    [picker],
  );

  const toggleGuest = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const q = query.trim();
    if (skipSuggest.current) {
      skipSuggest.current = false;
      setSuggestions([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setSearching(true);
    setSearchError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = await searchPlaces(q, biasRef.current, controller.signal);
          if (cancelled) return;
          setSuggestions(rows);
          setSearchError(rows.length === 0 ? 'Nenhum endereço encontrado para essa busca.' : null);
        } catch (e) {
          if (cancelled || isAbortError(e)) return;
          setSuggestions([]);
          setSearchError(
            e instanceof Error ? e.message : 'Não foi possível buscar endereços. Tente de novo.',
          );
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const pickPlace = async (place: PlaceSuggestion) => {
    skipSuggest.current = true;
    userPickedPlace.current = true;
    setQuery(place.detail ? `${place.label} · ${place.detail}` : place.label);
    setSuggestions([]);
    setSearchError(null);
    setPlaceLabel(place.detail ? `${place.label} · ${place.detail}` : place.label);
    Keyboard.dismiss();
    await applyCoords(
      { latitude: place.latitude, longitude: place.longitude },
      { recenter: true, reverse: false },
    );
  };

  const onSearchPlace = async () => {
    const address = query.trim();
    if (address.length < 2) {
      show({ title: 'Busca', message: 'Digite pelo menos 2 letras para buscar o endereço.' });
      return;
    }
    if (suggestions[0]) {
      await pickPlace(suggestions[0]);
      return;
    }
    try {
      setSearching(true);
      setSearchError(null);
      const rows = await searchPlaces(address, coords);
      if (rows[0]) {
        setSuggestions(rows);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const geo = await Location.geocodeAsync(address);
        const hit = geo[0];
        if (hit) {
          await pickPlace({
            id: `geo-${hit.latitude},${hit.longitude}`,
            label: address,
            detail: `${hit.latitude.toFixed(5)}, ${hit.longitude.toFixed(5)}`,
            latitude: hit.latitude,
            longitude: hit.longitude,
          });
          return;
        }
      }

      setSuggestions([]);
      setSearchError('Nenhum endereço encontrado para essa busca.');
    } catch (e) {
      if (isAbortError(e)) return;
      const message =
        e instanceof Error ? e.message : 'Não foi possível buscar endereços. Tente de novo.';
      setSearchError(message);
      show({ title: 'Não foi possível buscar', message });
    } finally {
      setSearching(false);
    }
  };

  const onUseMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        show({ title: 'Localização', message: 'Autorize a localização para usar sua posição atual.' });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      userPickedPlace.current = true;
      await applyCoords(
        { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
        { recenter: true },
      );
    } catch (e) {
      show({
        title: 'GPS',
        message: e instanceof Error ? e.message : 'Não deu para obter sua posição.',
      });
    }
  };

  const onSaveCustomIcon = async () => {
    if (!user) return;
    try {
      setSavingIcon(true);
      const created = await addCustomIcon(user.id, newEmoji, newIconName);
      await refreshCustomIcons();
      setIcon(created);
      setNewEmoji('');
      setNewIconName('');
      setIconModal(false);
    } catch (e) {
      show({ title: 'Ícone', message: e instanceof Error ? e.message : 'Não foi possível salvar o ícone.' });
    } finally {
      setSavingIcon(false);
    }
  };

  const dateLabel = useMemo(
    () =>
      occursAt.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [occursAt],
  );
  const timeLabel = useMemo(
    () => occursAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    [occursAt],
  );

  const goToResenha = (id: string) => {
    setCalendarPrompt(null);
    router.replace(`/(app)/resenhas/${id}`);
  };

  const attachGoogleCalendar = async (pending: NonNullable<typeof calendarPrompt>) => {
    setCalendarBusy(true);
    try {
      const { emails, skipped } = guestEmailsFromProfiles(
        contacts,
        pending.guestIds,
        user?.email,
      );
      const payload = {
        name: pending.name,
        occursAt: pending.occursAt,
        latitude: pending.latitude,
        longitude: pending.longitude,
        placeLabel: pending.placeLabel,
        guestEmails: emails,
        organizerEmail: user?.email,
      };
      let token = await ensureGoogleCalendarAccess();
      try {
        await createResenhaCalendarEvent(token, payload);
      } catch (e) {
        const status = (e as { status?: number }).status ?? 0;
        if (!isGoogleCalendarAuthError(status)) throw e;
        token = await ensureGoogleCalendarAccess({ force: true });
        await createResenhaCalendarEvent(token, payload);
      }
      if (skipped > 0 && emails.length === 0) {
        show({
          title: 'Agenda criada',
          message:
            'O evento entrou na sua agenda. Os convidados não têm e-mail no perfil, então o Google não pôde enviá-los o convite.',
        });
      } else if (skipped > 0) {
        show({
          title: 'Agenda criada',
          message: `${emails.length} convite(s) enviados. ${skipped} pessoa(s) sem e-mail no perfil ficaram de fora.`,
        });
      }
      goToResenha(pending.id);
    } catch (e) {
      if (isGoogleAuthCancelled(e)) {
        const detail = e instanceof Error ? e.message.replace(/^Login Google cancelado\.\s*/i, '') : '';
        setCalendarError(
          `A autorização do Google não voltou para o app. Feche a aba do Google e tente de novo. ${detail}`.trim(),
        );
      } else {
        setCalendarError(friendlyCalendarError(e));
      }
    } finally {
      setCalendarBusy(false);
    }
  };

  const onSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const guestIds = [...selected];
      const id = await createResenha({
        name,
        occursAt,
        icon: icon.id,
        iconEmoji: icon.emoji,
        iconLabel: icon.label,
        latitude: coords.latitude,
        longitude: coords.longitude,
        guestIds,
      });
      setCalendarError(null);
      setCalendarPrompt({
        id,
        name: name.trim(),
        occursAt,
        latitude: coords.latitude,
        longitude: coords.longitude,
        placeLabel,
        guestIds,
      });
    } catch (e) {
      show({ title: 'Não foi possível marcar', message: friendlyResenhaError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: theme.screenPadding.horizontal, paddingBottom: chrome.tabClearance },
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled={!mapLocked}
      >
        <SoftInput theme={theme} placeholder="Nome da resenha" value={name} onChangeText={setName} />

        <Text style={[theme.typography.label, styles.section, { color: theme.colors.textSecondary }]}>
          Quando
        </Text>
        <View style={styles.whenRow}>
          <Pressable
            onPress={() => setPicker('date')}
            style={[styles.whenBtn, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}
          >
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>{dateLabel}</Text>
          </Pressable>
          <Pressable
            onPress={() => setPicker('time')}
            style={[styles.whenBtn, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}
          >
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>{timeLabel}</Text>
          </Pressable>
        </View>
        {picker ? (
          <DateTimePicker
            value={occursAt}
            mode={picker}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onValueChange={onPickerValue}
            onDismiss={() => setPicker(null)}
            minimumDate={picker === 'date' ? new Date() : undefined}
            themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
          />
        ) : null}
        {Platform.OS === 'ios' && picker ? (
          <SoftButton theme={theme} variant="ghost" size="compact" label="OK" onPress={() => setPicker(null)} />
        ) : null}

        <Text style={[theme.typography.label, styles.section, { color: theme.colors.textSecondary }]}>
          Ícone
        </Text>
        <View style={styles.iconGrid}>
          {allIcons.map((item) => {
            const active = item.id === icon.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setIcon(item)}
                style={[
                  styles.iconCell,
                  {
                    backgroundColor: active ? theme.colors.brand.soft : theme.colors.surface,
                    borderColor: active ? theme.colors.brand.solid : theme.colors.borderSubtle,
                    borderRadius: theme.radii.lg,
                  },
                ]}
              >
                <Text style={styles.emoji}>{item.emoji}</Text>
                <Text
                  style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: 10 }}>
          <SoftButton
            theme={theme}
            variant="secondary"
            size="compact"
            label="Personalizar ícone"
            onPress={() => setIconModal(true)}
          />
        </View>

        <Text style={[theme.typography.label, styles.section, { color: theme.colors.textSecondary }]}>
          Local
        </Text>
        <SoftInput
          theme={theme}
          placeholder="Buscar bairro, cidade ou endereço"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          onSubmitEditing={() => {
            void onSearchPlace();
          }}
        />
        {query.trim().length >= 2 ? (
          <View
            style={[
              styles.suggestBox,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderSubtle,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            {searching && suggestions.length === 0 ? (
              <View style={styles.suggestRow}>
                <ActivityIndicator color={theme.colors.brand.solid} />
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  Buscando endereços…
                </Text>
              </View>
            ) : null}
            {suggestions.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  void pickPlace(item);
                }}
                style={({ pressed }) => [
                  styles.suggestItem,
                  { opacity: pressed ? 0.85 : 1, borderBottomColor: theme.colors.borderSubtle },
                ]}
              >
                <Text
                  style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.detail ? (
                  <Text
                    style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}
                    numberOfLines={2}
                  >
                    {item.detail}
                  </Text>
                ) : null}
              </Pressable>
            ))}
            {!searching && suggestions.length === 0 && searchError ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.danger, paddingHorizontal: 14, paddingVertical: 12 },
                ]}
              >
                {searchError}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 8 }]}>
            Digite o endereço para ver sugestões e tocar na que quiser marcar.
          </Text>
        )}
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SoftButton
              theme={theme}
              variant="secondary"
              size="compact"
              label={searching ? 'Buscando…' : 'Buscar'}
              onPress={() => {
                void onSearchPlace();
              }}
              loading={searching}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SoftButton
              theme={theme}
              variant="ghost"
              size="compact"
              label="Minha localização"
              onPress={() => {
                void onUseMyLocation();
              }}
            />
          </View>
        </View>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginBottom: 10 }]}>
          {placeLabel ?? 'Toque no mapa, arraste o pin ou busque um endereço.'}
        </Text>
        <View
          collapsable={false}
          style={[styles.mapFrame, { borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface }]}
        >
          <ResenhaMap
            latitude={coords.latitude}
            longitude={coords.longitude}
            height={320}
            pinDraggable
            cameraKey={cameraKey}
            onTouchStart={() => setMapLocked(true)}
            onTouchEnd={() => setMapLocked(false)}
            onChange={(next) => {
              userPickedPlace.current = true;
              void applyCoords(next);
            }}
          />
        </View>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 8 }]}>
          {coords.latitude.toFixed(5)} · {coords.longitude.toFixed(5)}
        </Text>

        <Text style={[theme.typography.label, styles.section, { color: theme.colors.textSecondary }]}>
          Quem vai
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginBottom: 10 }]}>
          Só dá para convidar quem está nos seus contatos. A pessoa precisa conhecer ao menos um
          participante da resenha.
        </Text>
        {loadingContacts ? (
          <ActivityIndicator color={theme.colors.brand.solid} />
        ) : contacts.length === 0 ? (
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            Adicione contatos antes de marcar uma resenha.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {contacts.map((contact) => {
              const active = selected.has(contact.id);
              return (
                <Pressable
                  key={contact.id}
                  onPress={() => toggleGuest(contact.id)}
                  style={[
                    styles.guest,
                    {
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.radii.lg,
                      borderWidth: active ? 1.5 : 0,
                      borderColor: theme.colors.brand.solid,
                    },
                  ]}
                >
                  <SoftAvatar theme={theme} uri={contact.avatar_url} name={contact.display_name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                      {contact.display_name ?? displayNameFor(contact)}
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                      {displayNameFor(contact)}
                    </Text>
                  </View>
                  <Text style={{ color: active ? theme.colors.brand.solid : theme.colors.textMuted }}>
                    {active ? '✓' : '+'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ marginTop: theme.spacing.lg }}>
          <SoftButton theme={theme} label="Marcar resenha" onPress={onSave} loading={saving} />
        </View>
      </ScrollView>

      <Modal visible={iconModal} transparent animationType="fade" onRequestClose={() => setIconModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIconModal(false)} />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.xl,
                ...theme.shadows.softStrong,
              },
            ]}
          >
            <Text style={[theme.typography.heading, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
              Novo ícone
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 16 },
              ]}
            >
              Escolha um emoji e um nome. Ele fica só neste aparelho para você marcar resenhas.
            </Text>
            <SoftInput
              theme={theme}
              placeholder="Emoji (ex.: 🎸)"
              value={newEmoji}
              onChangeText={setNewEmoji}
              autoCapitalize="none"
            />
            <View style={{ height: 12 }} />
            <SoftInput
              theme={theme}
              placeholder="Nome do ícone"
              value={newIconName}
              onChangeText={setNewIconName}
              maxLength={24}
            />
            <View style={{ marginTop: 18, gap: 10 }}>
              <SoftButton theme={theme} label="Salvar ícone" onPress={() => void onSaveCustomIcon()} loading={savingIcon} />
              <SoftButton theme={theme} variant="ghost" label="Cancelar" onPress={() => setIconModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(calendarPrompt)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!calendarBusy && calendarPrompt) goToResenha(calendarPrompt.id);
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radii.xl,
                ...theme.shadows.softStrong,
              },
            ]}
          >
            <Text style={[theme.typography.heading, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
              Google Agenda
            </Text>
            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.colors.textSecondary,
                  textAlign: 'center',
                  marginTop: theme.spacing.sm,
                },
              ]}
            >
              {calendarError
                ? 'A resenha já está marcada. O Google Agenda não foi concluído — você pode tentar de novo.'
                : 'Quer também criar um lembrete no Google Agenda de cada participante? Você entra como organizador e os demais como convidados (2 horas de duração).'}
            </Text>
            {calendarError ? (
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.danger, textAlign: 'center', marginTop: 10 },
                ]}
              >
                {calendarError}
              </Text>
            ) : null}
            <View style={{ marginTop: 18, gap: 10 }}>
              <SoftButton
                theme={theme}
                label={calendarError ? 'Tentar de novo' : 'Sim, criar no Agenda'}
                onPress={() => {
                  if (calendarPrompt) void attachGoogleCalendar(calendarPrompt);
                }}
                loading={calendarBusy}
                disabled={calendarBusy}
              />
              <SoftButton
                theme={theme}
                variant="ghost"
                label={calendarError ? 'Continuar sem Agenda' : 'Agora não'}
                onPress={() => {
                  if (calendarPrompt) goToResenha(calendarPrompt.id);
                }}
                disabled={calendarBusy}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingTop: 16 },
  section: { marginTop: 22, marginBottom: 8 },
  whenRow: { flexDirection: 'row', gap: 10 },
  whenBtn: { flex: 1, paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconCell: {
    width: '18%',
    minWidth: 64,
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
  },
  emoji: { fontSize: 22 },
  searchRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 10 },
  suggestBox: {
    marginTop: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  suggestItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mapFrame: {
    overflow: 'hidden',
    height: 320,
    width: '100%',
  },
  guest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    padding: 22,
  },
});
