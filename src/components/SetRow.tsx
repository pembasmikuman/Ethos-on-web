import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from '../rn';
import { fonts, useTheme } from '../lib/theme';
import { fmtKg } from '../lib/format';
import type { Field, SetDraft } from '../store/workout';
import type { LoggedSet } from '../db/queries';
import type { Load } from '../db';
import { Doto, Label } from './Text';

type Props = {
  index: number;
  workingNumber: number;
  set: SetDraft;
  prev?: LoggedSet;
  targetMax: number;
  load?: Load;
  perSide?: boolean;
  active: boolean;
  focusField: Field | null;
  onFocus: (field: Field) => void;
  onNotes: (notes: string) => void;
  onLongPress?: () => void;
};

/** Column widths, shared by the header so the labels sit over their boxes. */
export const COLS = { num: 30, weight: 1.25, reps: 1, rir: 0.9, gap: 6 };

/** Kg · Reps · RIR, the header over a list of SetRows. */
export function SetHeader({ load = 'weight' }: { load?: Load }) {
  const col = (label: string, flex: number) => <Label size={10} style={{ flex, flexBasis: 0, textAlign: 'center' }}>{label}</Label>;
  return (
    <View style={[s.line, { paddingBottom: 2 }]}>
      <View style={{ width: COLS.num }} />
      {col(load === 'bodyweight' ? '+kg' : 'kg', COLS.weight)}
      {col(load === 'time' ? 'Sec' : 'Reps', COLS.reps)}
      {col('RIR', COLS.rir)}
    </View>
  );
}

export function SetRow({ workingNumber, set, prev, targetMax, load = 'weight', perSide = false, active, focusField, onFocus, onNotes, onLongPress }: Props) {
  const t = useTheme();
  const warm = set.type === 'warmup';
  const prevText = prev ? `prev ${fmtKg(prev.weight)} × ${prev.reps}${prev.rir != null ? ` @ ${prev.rir}` : ''}${prev.notes ? ` · ${prev.notes}` : ''}` : '';
  const side = perSide && set.reps !== '' ? `${Number(set.reps) / 2} per side` : '';
  const hint = [prevText, active && !warm ? `target ${targetMax}${load === 'time' ? 's' : ''}` : '', side].filter(Boolean).join(' · ');
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const note = set.notes ?? '';
  const ring = set.done ? t.accent : active ? t.text : warm ? t.warm : t.dim;

  const box = (field: Field, flex: number) => {
    const v = set[field];
    const focused = active && focusField === field;
    return (
      <Pressable onPress={() => onFocus(field)} style={[s.box, { flex, borderColor: focused ? t.accent : t.line, backgroundColor: focused ? t.warnBg : t.bg }]}>
        <Doto size={22} color={focused ? t.accent : v === '' ? t.dim : set.done || active ? t.text : t.mute}>{v === '' ? '–' : v}</Doto>
      </Pressable>
    );
  };

  return (
    <Pressable onLongPress={onLongPress} style={[s.row, { backgroundColor: t.card }]}>
      <View style={s.line}>
        <View style={[s.num, { borderColor: ring, backgroundColor: set.done ? t.accent : 'transparent' }]}>
          <Label size={12} color={set.done ? t.bg : ring} style={{ letterSpacing: 0 }}>{warm ? 'W' : String(workingNumber)}</Label>
        </View>
        {box('weight', COLS.weight)}
        {box('reps', COLS.reps)}
        {warm ? <View style={{ flex: COLS.rir }} /> : box('rir', COLS.rir)}
      </View>
      {hint !== '' && <Label color={active ? t.mute : t.dim} size={10} style={{ paddingLeft: COLS.num + COLS.gap }}>{hint}</Label>}
      {/* The note: one quiet line under the set. Closed it shows a single line; tap opens it in full, tap again edits. */}
      {typing ? (
        <TextInput value={note} onChangeText={onNotes} onBlur={() => { setTyping(false); setOpen(false); }} autoFocus placeholder="note" maxLength={80} style={[s.note, s.input, { color: t.text, borderBottomColor: t.accent }]} />
      ) : note ? (
        <Pressable onPress={() => (open ? setTyping(true) : setOpen(true))} style={s.note}>
          <span style={{ fontFamily: fonts.mono, fontSize: 11, lineHeight: '15px', color: t.mute, overflowWrap: 'anywhere', ...(open ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>{note}</span>
        </Pressable>
      ) : active ? (
        <Pressable onPress={() => setTyping(true)} style={s.note} hitSlop={8}><Label size={10} color={t.dim}>+ note</Label></Pressable>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { gap: 4, paddingVertical: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: COLS.gap },
  num: { width: COLS.num, height: COLS.num, borderRadius: COLS.num / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  box: { flexBasis: 0, height: 46, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  note: { marginLeft: COLS.num + COLS.gap, paddingVertical: 2 },
  input: { fontFamily: fonts.mono, fontSize: 11, paddingVertical: 4, borderBottomWidth: 1, borderBottomStyle: 'solid' },
});
