import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { storageGet, storageSet } from '../utils/safeStorage';

const THEME_KEY = '@camvision_theme_mode';

export const lightColors = {
  mode: 'light',
  bg: '#f8fafc',
  bgElevated: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  border: 'rgba(15, 23, 42, 0.08)',
  primary: '#059669',
  primarySoft: 'rgba(16, 185, 129, 0.12)',
  accent: '#047857',
  card: '#ffffff',
  cardDark: '#0f172a',
  bubbleUser: '#059669',
  bubbleAi: '#e2e8f0',
  danger: '#dc2626',
  modalBg: 'rgba(255, 255, 255, 0.96)',
  modalText: '#0f172a',
  modalMuted: '#64748b',
  miniPlayer: 'rgba(248, 250, 252, 0.98)',
};

export const darkColors = {
  mode: 'dark',
  bg: '#0b1220',
  bgElevated: '#111827',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  border: 'rgba(148, 163, 184, 0.18)',
  primary: '#34d399',
  primarySoft: 'rgba(52, 211, 153, 0.16)',
  accent: '#10b981',
  card: '#1e293b',
  cardDark: '#020617',
  bubbleUser: '#059669',
  bubbleAi: '#334155',
  danger: '#f87171',
  modalBg: 'rgba(15, 23, 42, 0.96)',
  modalText: '#f8fafc',
  modalMuted: '#94a3b8',
  miniPlayer: 'rgba(15, 23, 42, 0.98)',
};

const ThemeContext = createContext({
  mode: 'system',
  isDark: false,
  colors: lightColors,
  setMode: () => {},
});

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState('system');

  useEffect(() => {
    storageGet(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = useCallback(async (next) => {
    setModeState(next);
    await storageSet(THEME_KEY, next);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(
    () => ({ mode, isDark, colors, setMode }),
    [mode, isDark, colors, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
