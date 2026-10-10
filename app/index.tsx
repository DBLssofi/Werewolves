/**
 * Setup screen (first prototype).
 * Will be replaced by the new setup flow from the App Spec (milestone 3).
 * ─────────────────────────────────────────────────────────────
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

const { width } = Dimensions.get('window');

// ─── Main Component ──────────────────────────────────────────
export default function SetupScreen() {
  const [step, setStep] = useState('count');
  const [playerCount, setPlayerCount] = useState(8);
  const [playerNames, setPlayerNames] = useState(Array(8).fill(''));

  // Fade animation used when switching steps
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const fadeTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setTimeout(callback, 150);
  };

  const changeCount = (delta: number) => {
    const next = Math.min(50, Math.max(8, playerCount + delta));
    setPlayerCount(next);
    setPlayerNames(prev => {
      if (next > prev.length) return [...prev, ...Array(next - prev.length).fill('')];
      return prev.slice(0, next);
    });
  };

  const goToNames = () => fadeTransition(() => setStep('names'));
  const goToMode  = () => fadeTransition(() => setStep('mode'));
  const goBack    = () => fadeTransition(() => setStep(step === 'mode' ? 'names' : 'count'));

  // ── Placeholder: wire these up to your real game logic later ──
  const handleClassic  = () => alert('Classic mode → connect to your game logic!');
  const handleAdvanced = () => alert('Advanced mode → connect to your game logic!');

  return (
    <SafeAreaView style={styles.root}>

      {/* ── Fixed header ── */}
      <View style={styles.header}>
        {step !== 'count' && (
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.logo}>RED BLOOD MOON</Text>
          <Text style={styles.logoSub}>Game Master Assistant</Text>
        </View>
        {/* Step dots */}
        <View style={styles.dots}>
          {(['count', 'names', 'mode'] ).map((s, i) => (
            <View key={i} style={[styles.dot, step === s && styles.dotActive]} />
          ))}
        </View>
      </View>

      {/* ── Animated content area ── */}
      <Animated.View style={[styles.body, { opacity: fadeAnim }]}>

        {/* ───────────────── STEP 1: Player count ───────────────── */}
        {step === 'count' && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepLabel}>HOW MANY PLAYERS?</Text>

            <View style={styles.counterRow}>
              <TouchableOpacity
                onPress={() => changeCount(-1)}
                style={[styles.counterBtn, playerCount <= 8 && styles.counterBtnDisabled]}
                disabled={playerCount <= 8}
              >
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>

              <View style={styles.counterNumWrap}>
                <Text style={styles.counterNum}>{playerCount}</Text>
                <Text style={styles.counterNumSub}>players</Text>
              </View>

              <TouchableOpacity
                onPress={() => changeCount(1)}
                style={[styles.counterBtn, playerCount >= 50 && styles.counterBtnDisabled]}
                disabled={playerCount >= 50}
              >
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Quick-pick chips */}
            <Text style={styles.quickLabel}>QUICK SELECT</Text>
            <View style={styles.chips}>
              {[8, 10, 12, 15, 20].map(n => (
                <TouchableOpacity
                  key={n}
                  onPress={() => {
                    setPlayerCount(n);
                    setPlayerNames(Array(n).fill(''));
                  }}
                  style={[styles.chip, playerCount === n && styles.chipActive]}
                >
                  <Text style={[styles.chipText, playerCount === n && styles.chipTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={goToNames}>
              <Text style={styles.primaryBtnText}>CONTINUE →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ───────────────── STEP 2: Player names ──────────────── */}
        {step === 'names' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <Text style={styles.stepLabel}>NAME YOUR VILLAGERS</Text>
            <Text style={styles.stepHint}>Leave blank to use Player 1, 2… etc.</Text>

            <ScrollView
              style={styles.namesList}
              contentContainerStyle={styles.namesContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {playerNames.map((name, i) => (
                <View key={i} style={styles.nameRow}>
                  <View style={styles.nameIndex}>
                    <Text style={styles.nameIndexText}>{i + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.nameInput}
                    placeholder={`Player ${i + 1}`}
                    placeholderTextColor="#444"
                    value={name}
                    onChangeText={text => {
                      const updated = [...playerNames];
                      updated[i] = text;
                      setPlayerNames(updated);
                    }}
                    returnKeyType={i < playerNames.length - 1 ? 'next' : 'done'}
                    autoCapitalize="words"
                  />
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.primaryBtn} onPress={goToMode}>
                <Text style={styles.primaryBtnText}>CONFIRM PLAYERS →</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* ───────────────── STEP 3: Game mode ─────────────────── */}
        {step === 'mode' && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepLabel}>CHOOSE YOUR MODE</Text>

            {/* Classic card */}
            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardClassic]}
              onPress={handleClassic}
              activeOpacity={0.85}
            >
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>BALANCED</Text>
              </View>
              <Text style={styles.modeTitle}>CLASSIC</Text>
              <Text style={styles.modeDesc}>
                Roles are automatically assigned: Seer, Witch, Hunter, Salvator
                + Werewolves. Fast to set up, perfect for new groups.
              </Text>
              <View style={styles.modeRoleList}>
                {['🔍 Seer', '🧪 Witch', '🏹 Hunter', '🛡 Salvator', '🐺 Werewolves'].map(r => (
                  <View key={r} style={styles.modeRoleTag}>
                    <Text style={styles.modeRoleTagText}>{r}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>

            {/* Advanced card */}
            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardAdvanced]}
              onPress={handleAdvanced}
              activeOpacity={0.85}
            >
              <View style={[styles.modeBadge, styles.modeBadgeRed]}>
                <Text style={[styles.modeBadgeText, styles.modeBadgeTextRed]}>FULL CONTROL</Text>
              </View>
              <Text style={[styles.modeTitle, styles.modeTitleRed]}>ADVANCED</Text>
              <Text style={styles.modeDesc}>
                Pick every role manually. Includes Alpha Wolf, Dark Wolf,
                Sneaky Wolf, Cupid, Masons, Beholder and more.
              </Text>
              <Text style={styles.modeArrow}>→</Text>
            </TouchableOpacity>

            {/* Player count reminder */}
            <View style={styles.playerPill}>
              <Text style={styles.playerPillText}>👥  {playerCount} players</Text>
            </View>
          </View>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const RED = '#dc2626';
const DARK = '#0a0a0a';
const SURFACE = '#161616';
const BORDER = '#2a2a2a';
const TEXT = '#f5f5f5';
const MUTED = '#555';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK,
  },

  // ── Header ──
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: MUTED,
    fontSize: 22,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    color: RED,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  logoSub: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    width: 36,
    justifyContent: 'flex-end',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: BORDER,
  },
  dotActive: {
    backgroundColor: RED,
    width: 14,
  },

  // ── Body ──
  body: {
    flex: 1,
  },
  stepWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  stepLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepHint: {
    color: '#333',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },

  // ── Counter ──
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginTop: 20,
    marginBottom: 40,
  },
  counterBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
  },
  counterBtnDisabled: {
    opacity: 0.25,
  },
  counterBtnText: {
    color: TEXT,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '300',
  },
  counterNumWrap: {
    alignItems: 'center',
    minWidth: 90,
  },
  counterNum: {
    color: TEXT,
    fontSize: 80,
    fontWeight: '900',
    lineHeight: 88,
    letterSpacing: -4,
  },
  counterNumSub: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  // ── Quick chips ──
  quickLabel: {
    color: '#333',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 12,
  },
  chips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 40,
  },
  chip: {
    width: 48,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
  },
  chipActive: {
    backgroundColor: RED,
    borderColor: RED,
  },
  chipText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#fff',
  },

  // ── Primary button ──
  primaryBtn: {
    backgroundColor: RED,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3,
  },

  // ── Names list ──
  namesList: {
    flex: 1,
    marginTop: 8,
  },
  namesContent: {
    paddingHorizontal: 24,
    gap: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: SURFACE,
    borderWidth: 0.5,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameIndexText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
  },
  nameInput: {
    flex: 1,
    backgroundColor: SURFACE,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TEXT,
    fontSize: 15,
    fontWeight: '500',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
  },

  // ── Mode cards ──
  modeCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
  },
  modeCardClassic: {
    backgroundColor: SURFACE,
    borderColor: BORDER,
  },
  modeCardAdvanced: {
    backgroundColor: '#1a0505',
    borderColor: '#3d1010',
  },
  modeBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  modeBadgeRed: {
    borderColor: '#5c1a1a',
    backgroundColor: '#2a0808',
  },
  modeBadgeText: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  modeBadgeTextRed: {
    color: '#ff6b6b',
  },
  modeTitle: {
    color: TEXT,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 8,
  },
  modeTitleRed: {
    color: '#ff4444',
  },
  modeDesc: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  modeRoleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modeRoleTag: {
    backgroundColor: '#1f1f1f',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  modeRoleTagText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
  },
  modeArrow: {
    color: RED,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'right',
  },

  // ── Player pill ──
  playerPill: {
    alignSelf: 'center',
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginTop: 4,
  },
  playerPillText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
