/**
 * The shared building blocks, matching the Figma components (Button, Option, Counter, Seat, Card, Top bar).
 * Layout uses start/end (not left/right) so screens mirror correctly in Arabic.
 */
import React, { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { color, radius, space, text, touch } from './theme';

// ─── text ──────────────────────────────────────────────────

type TxtVariant = keyof typeof text;
type TxtTone = 'primary' | 'muted' | 'accent' | 'gold' | 'disabled';
const tones: Record<TxtTone, string> = {
  primary: color.textPrimary,
  muted: color.textMuted,
  accent: color.textAccent,
  gold: color.textGold,
  disabled: color.textDisabled,
};

export function Txt(props: {
  variant?: TxtVariant;
  tone?: TxtTone;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const { variant = 'body', tone = 'primary', center, style, children, numberOfLines } = props;
  return (
    <Text numberOfLines={numberOfLines} style={[text[variant], { color: tones[tone] }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

// ─── screen ────────────────────────────────────────────────

/** A glowing blood moon, drawn in code (placeholder for the final artwork). */
export function Moon({ size = 200 }: { size?: number }) {
  // Unique gradient ids: several moons can be mounted at once (screens stay in the stack).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const glowId = `glow${uid}`;
  const faceId = `face${uid}`;
  const glow = size * 1.6;
  return (
    <View style={{ width: glow, height: glow, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={glow} height={glow}>
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0.55" stopColor={color.accent} stopOpacity="0.45" />
            <Stop offset="1" stopColor={color.bgApp} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={faceId} cx="40%" cy="38%" r="65%">
            <Stop offset="0" stopColor="#E0605A" />
            <Stop offset="0.7" stopColor={color.accent} />
            <Stop offset="1" stopColor={color.accentDeep} />
          </RadialGradient>
        </Defs>
        <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#${glowId})`} />
        <Circle cx={glow / 2} cy={glow / 2} r={size / 2} fill={`url(#${faceId})`} />
        <Circle cx={glow / 2 - size * 0.15} cy={glow / 2 - size * 0.1} r={size * 0.09} fill={color.accentDeep} opacity={0.35} />
        <Circle cx={glow / 2 + size * 0.18} cy={glow / 2 + size * 0.12} r={size * 0.13} fill={color.accentDeep} opacity={0.3} />
        <Circle cx={glow / 2 + size * 0.05} cy={glow / 2 - size * 0.25} r={size * 0.05} fill={color.accentDeep} opacity={0.35} />
      </Svg>
    </View>
  );
}

/** Every screen: dark background, safe area, optional top bar, scrolling content and a bottom action area. */
export function Screen(props: { top?: ReactNode; children: ReactNode; bottom?: ReactNode; scroll?: boolean; moon?: 'corner' | 'none' }) {
  const { top, children, bottom, scroll = true, moon = 'corner' } = props;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      {moon === 'corner' && (
        <View style={[styles.cornerMoon, { opacity: 0.55 }]} pointerEvents="none">
          <Moon size={230} />
        </View>
      )}
      {top}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
      {bottom && <View style={styles.bottom}>{bottom}</View>}
    </SafeAreaView>
  );
}

export function TopBar(props: { title: string; onBack?: () => void; backLabel: string; onMenu?: () => void; menuLabel?: string }) {
  return (
    <View style={styles.topBar}>
      <IconButton label={props.backLabel} onPress={props.onBack} glyph="‹" hidden={!props.onBack} />
      <Txt variant="label" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {props.title}
      </Txt>
      <IconButton label={props.menuLabel ?? ''} onPress={props.onMenu} glyph="☰" hidden={!props.onMenu} />
    </View>
  );
}

function IconButton(props: { label: string; onPress?: () => void; glyph: string; hidden?: boolean }) {
  if (props.hidden) return <View style={styles.icon} />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={props.label} onPress={props.onPress} style={styles.icon} hitSlop={8}>
      <Text style={{ color: color.textPrimary, fontSize: 26 }}>{props.glyph}</Text>
    </Pressable>
  );
}

// ─── controls ──────────────────────────────────────────────

export function Button(props: {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
  size?: 'large' | 'medium';
  style?: StyleProp<ViewStyle>;
}) {
  const { label, onPress, kind = 'primary', disabled, size = 'large', style } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'medium' && styles.buttonMedium,
        // Primary: solid red; when it can't be pressed yet it dims to a dark red, so it never looks like a secondary button.
        // Secondary: outlined, no fill, so it reads as "another option" rather than "not available".
        kind === 'primary'
          ? { backgroundColor: disabled ? color.accentDisabled : pressed ? color.accentPressed : color.accent }
          : {
              backgroundColor: pressed ? color.bgSecondaryPressed : 'transparent',
              borderWidth: 1.5,
              borderColor: disabled ? color.border : color.borderStrong,
            },
        style,
      ]}
    >
      <Txt variant={size === 'large' ? 'buttonLarge' : 'buttonMedium'} tone={disabled ? 'muted' : 'primary'} center>
        {label}
      </Txt>
    </Pressable>
  );
}

export function OptionRow(props: { label: string; selected: boolean; onPress: () => void; hint?: string }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: props.selected }} onPress={props.onPress} style={styles.option}>
      <View style={[styles.mark, props.selected && { borderWidth: 2, borderColor: color.selected }]}>
        {props.selected && <View style={styles.dot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="option">{props.label}</Txt>
        {props.hint ? (
          <Txt variant="small" tone="muted">
            {props.hint}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

export function Counter(props: { value: number; min: number; max: number; onChange: (n: number) => void; minusLabel: string; plusLabel: string; small?: boolean }) {
  const { value, min, max, onChange, small } = props;
  const box = small ? 48 : 72;
  return (
    <View style={[styles.row, { gap: small ? space.md : space.x2 }]}>
      <StepButton glyph="−" label={props.minusLabel} disabled={value <= min} onPress={() => onChange(Math.max(min, value - 1))} small={small} />
      <View style={[styles.valueBox, { width: box, height: box }]}>
        <Txt variant={small ? 'option' : 'title'}>{value}</Txt>
      </View>
      <StepButton glyph="+" label={props.plusLabel} disabled={value >= max} onPress={() => onChange(Math.min(max, value + 1))} small={small} />
    </View>
  );
}

function StepButton(props: { glyph: string; label: string; onPress: () => void; disabled: boolean; small?: boolean }) {
  const size = props.small ? 40 : touch;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.step,
        { width: size, height: size, backgroundColor: props.disabled ? color.dead : pressed ? color.accentPressed : color.accent },
      ]}
    >
      <Txt variant="buttonLarge">{props.glyph}</Txt>
    </Pressable>
  );
}

/** A player chip: seat number and name. */
export function Seat(props: { seat: number; name: string; state?: 'alive' | 'selected' | 'dead' | 'crossed'; detail?: string; onPress?: () => void; wide?: boolean }) {
  const { seat, name, state = 'alive', detail, onPress, wide } = props;
  const dead = state === 'dead';
  const content = (
    <>
      <View style={[styles.seatNo, { backgroundColor: dead ? color.bgApp : color.bgCard }]}>
        <Txt variant="small" tone={dead ? 'disabled' : 'primary'}>
          {seat + 1}
        </Txt>
      </View>
      <View style={{ flex: 1 }}>
        <Txt numberOfLines={1} tone={dead ? 'disabled' : 'primary'} style={dead && { textDecorationLine: 'line-through' }}>
          {name}
        </Txt>
        {detail ? (
          <Txt variant="small" tone="muted" numberOfLines={1}>
            {detail}
          </Txt>
        ) : null}
      </View>
      {state === 'crossed' && <Txt tone="muted">✕</Txt>}
    </>
  );
  const style = [styles.seat, wide && { width: '100%' as const }, state === 'selected' && { borderWidth: 2, borderColor: color.selected }];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: state === 'selected', disabled: dead }} onPress={onPress} style={style}>
      {content}
    </Pressable>
  );
}

/** A role card, face down (all identical) or revealed. */
export function RoleCard(props: { face: 'back' | 'revealed'; roleName?: string; onPress?: () => void; size?: 'small' | 'large'; label?: string }) {
  const { t } = useTranslation();
  const large = props.size === 'large';
  const w = large ? 220 : 100;
  const h = large ? 300 : 136;
  const body =
    props.face === 'back' ? (
      <>
        <Svg width={large ? 96 : 44} height={large ? 96 : 44}>
          <Circle cx="50%" cy="50%" r="46%" fill={color.accentDeep} stroke={color.accent} strokeWidth={2} />
        </Svg>
        <Txt variant="card" tone="gold" center>
          {t('app.cardMark')}
        </Txt>
      </>
    ) : (
      <Txt variant={large ? 'heading' : 'card'} tone="gold" center>
        {props.roleName ?? ''}
      </Txt>
    );
  const style = [styles.card, { width: w, height: h }];
  if (!props.onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={props.label} onPress={props.onPress} style={({ pressed }) => [style, pressed && { opacity: 0.8 }]}>
      {body}
    </Pressable>
  );
}

/** Press and hold to see something privately; it hides again on release. */
export function HoldToReveal(props: { hint: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPressIn={() => setOpen(true)} onPressOut={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={props.hint} style={styles.hold}>
      {open ? props.children : <RoleCard face="back" size="large" />}
      {!open && (
        <Txt variant="label" tone="muted" center style={{ marginTop: space.lg }}>
          {props.hint}
        </Txt>
      )}
    </Pressable>
  );
}

export function Gap({ h = space.lg }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Panel(props: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, props.style]}>{props.children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgApp },
  cornerMoon: { position: 'absolute', top: -150, start: -160 },
  content: { paddingHorizontal: space.lg, paddingVertical: space.lg, gap: space.lg },
  // Actions at the bottom run the full width: easier to hit one-handed in the dark.
  bottom: { paddingHorizontal: space.lg, paddingBottom: space.lg, paddingTop: space.sm, gap: space.md, alignItems: 'stretch' },
  topBar: { height: 56, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  button: {
    minWidth: 196,
    minHeight: 52,
    paddingHorizontal: space.x2,
    paddingVertical: space.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonMedium: { minWidth: 120, minHeight: touch, paddingHorizontal: space.xl, paddingVertical: space.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: touch, paddingVertical: space.sm },
  mark: { width: 30, height: 30, borderRadius: radius.full, backgroundColor: color.bgSurface, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: radius.full, backgroundColor: color.accent },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  valueBox: { borderRadius: radius.sm, backgroundColor: color.bgSurface, alignItems: 'center', justifyContent: 'center' },
  step: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touch,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    backgroundColor: color.bgSurface,
    width: '48%',
  },
  seatNo: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.sm, backgroundColor: color.bgCard, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.sm },
  hold: { alignItems: 'center', paddingVertical: space.lg },
  panel: { backgroundColor: color.bgSecondary, borderColor: color.border, borderWidth: 1, borderRadius: radius.sm, padding: space.lg, gap: space.sm },
});
