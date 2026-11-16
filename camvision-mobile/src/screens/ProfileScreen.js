import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import LanguageSelector from '../components/LanguageSelector';
import { useTheme } from '../theme/ThemeContext';
import { clearNearbyCache } from '../services/nearbyCache';
import { tabOverlayPadding } from '../utils/layout';
import {
  clearUserSession,
  loadUserSession,
  saveUserSession,
} from '../services/userSession';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();
  const [clearing, setClearing] = useState(false);
  const [session, setSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const themeOptions = [
    { id: 'light', label: t('profile.themeLight'), icon: 'sunny' },
    { id: 'dark', label: t('profile.themeDark'), icon: 'moon' },
    { id: 'system', label: t('profile.themeSystem'), icon: 'phone-portrait' },
  ];

  const version =
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '1.0.0';

  useEffect(() => {
    loadUserSession().then(setSession);
  }, []);

  const onLogin = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail.includes('@') || password.trim().length < 4) {
      setLoginError(t('profile.loginError'));
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const next = await saveUserSession({ email: mail, connectedAt: Date.now() });
      setSession(next);
      setShowLogin(false);
      setPassword('');
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const onLogout = async () => {
    await clearUserSession();
    setSession(null);
    setShowLogin(false);
    setEmail('');
    setPassword('');
  };

  const onClearCache = () => {
    Alert.alert(t('profile.clearCacheTitle'), t('profile.clearCacheMsg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.clearCacheConfirm'),
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await clearNearbyCache();
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              ).catch(() => {});
            }
            Alert.alert(t('profile.clearCacheDone'));
          } catch (_) {
            Alert.alert(t('profile.clearCacheError'));
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 24,
          paddingBottom: tabOverlayPadding(insets.bottom),
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={session ? 'person' : 'person-outline'} size={36} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>
        {session ? session.email : t('profile.title')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {session ? t('profile.account') : t('profile.subtitle')}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>{t('profile.account')}</Text>
        {session ? (
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}
            onPress={onLogout}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.primary} />
            <Text style={[styles.loginBtnText, { color: colors.primary }]}>
              {t('profile.logout')}
            </Text>
          </TouchableOpacity>
        ) : showLogin ? (
          <View style={styles.loginForm}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('profile.email')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg },
              ]}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('profile.password')}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoComplete="password"
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg },
              ]}
            />
            {!!loginError && (
              <Text style={[styles.loginErr, { color: colors.danger }]}>{loginError}</Text>
            )}
            <TouchableOpacity
              style={[styles.loginBtn, { backgroundColor: colors.primary }]}
              onPress={onLogin}
              disabled={loginLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={[styles.loginBtnText, { color: '#fff' }]}>
                {loginLoading ? '…' : t('profile.loginSubmit')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.rowSub, { color: colors.textMuted, marginBottom: 12 }]}>
              {t('profile.guestHint')}
            </Text>
            <TouchableOpacity
              style={[styles.loginBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowLogin(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('profile.login')}
            >
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={[styles.loginBtnText, { color: '#fff' }]}>{t('profile.login')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>{t('profile.language')}</Text>
        <LanguageSelector />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>{t('profile.theme')}</Text>
        <View style={[styles.segment, { backgroundColor: colors.primarySoft }]}>
          {themeOptions.map((opt) => {
            const active = mode === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.segmentItem,
                  active && { backgroundColor: colors.primary },
                ]}
                onPress={() => setMode(opt.id)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={opt.icon}
                  size={16}
                  color={active ? '#fff' : colors.text}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? '#fff' : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>{t('profile.data')}</Text>
        <TouchableOpacity
          style={[styles.rowBtn, { borderColor: colors.border }]}
          onPress={onClearCache}
          disabled={clearing}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              {t('profile.clearCache')}
            </Text>
            <Text style={[styles.rowSub, { color: colors.textMuted }]}>
              {t('profile.clearCacheHint')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.section, { color: colors.text }]}>{t('profile.about')}</Text>
        <Text style={[styles.aboutText, { color: colors.textMuted }]}>
          {t('profile.aboutBody')}
        </Text>
        <Text style={[styles.version, { color: colors.textMuted }]}>
          {t('profile.version', { version })}
        </Text>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', marginTop: 16 },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 24,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  section: {
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 14,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 11,
    minHeight: 44,
  },
  segmentLabel: { fontWeight: '700', fontSize: 11 },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  aboutText: { fontSize: 13, lineHeight: 20 },
  version: { fontSize: 12, fontWeight: '600', marginTop: 12 },
  loginForm: { gap: 10 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  loginBtnText: { fontSize: 15, fontWeight: '800' },
  loginErr: { fontSize: 13, fontWeight: '600' },
});
