// Web stand-ins for the React Native primitives the old screens use, so a ported screen only changes its imports.
// Each one takes the RN props the old code passes; props with no web meaning (hitSlop, keyboardShouldPersistTaps,
// placeholderTextColor, ...) are accepted and ignored.
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref, type SVGProps } from 'react';
import { css } from './lib/css';
import { useLongPress } from './lib/press';

export { Alert } from './lib/alert';

type StyleObj = Record<string, unknown>;
export type Style = StyleObj | false | null | undefined | Style[];
export type ViewStyle = Style;
export type TextStyle = Style;

const flat = (st: Style): StyleObj[] => (Array.isArray(st) ? st.flatMap(flat) : st ? [st] : []);
/** RN style (object, falsy, or nested arrays of those) to a CSS style object. */
export const sx = (...st: Style[]) => css(...st.flatMap(flat));

export const StyleSheet = {
  create: <T extends Record<string, StyleObj>>(s: T): T => s,
  hairlineWidth: 1 / (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1),
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as StyleObj,
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as StyleObj,
};

export const Platform = { OS: 'ios' as const, isPad: false, select: <T,>(o: { ios?: T; default?: T }) => o.ios ?? o.default };

export type LayoutEvent = { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } };

/** Calls onLayout with the element's box whenever its size changes, like RN's onLayout. */
function useLayout(el: React.RefObject<HTMLElement | null>, onLayout?: (e: LayoutEvent) => void) {
  const cb = useRef(onLayout);
  cb.current = onLayout;
  const wanted = !!onLayout;
  useEffect(() => {
    const n = el.current;
    if (!wanted || !n) return;
    const ro = new ResizeObserver(() => cb.current?.({ nativeEvent: { layout: { x: n.offsetLeft, y: n.offsetTop, width: n.offsetWidth, height: n.offsetHeight } } }));
    ro.observe(n);
    return () => ro.disconnect();
  }, [wanted, el]);
}

type ViewProps = { style?: Style; children?: ReactNode; onLayout?: (e: LayoutEvent) => void; pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only'; ref?: Ref<HTMLDivElement> };

export function View({ style, children, onLayout, pointerEvents, ref }: ViewProps) {
  const own = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => own.current!);
  useLayout(own, onLayout);
  return <div ref={own} style={sx(style, pointerEvents === 'none' && { pointerEvents: 'none' })}>{children}</div>;
}

type PressState = { pressed: boolean };
type PressableProps = {
  style?: Style | ((s: PressState) => Style);
  children?: ReactNode | ((s: PressState) => ReactNode);
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  delayLongPress?: number;
  disabled?: boolean;
  hitSlop?: unknown;
};

/** A div with role=button rather than a <button>, because the old screens nest Pressables and nested buttons are invalid HTML.
 *  The inner one wins the tap, as in RN. */
export function Pressable({ style, children, onPress, onLongPress, onPressIn, delayLongPress, disabled }: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const lp = useLongPress(disabled ? undefined : onLongPress, delayLongPress ?? 450) as Partial<Record<string, (e: any) => void>>;
  const st = { pressed };
  return (
    <div
      role="button"
      aria-disabled={disabled || undefined}
      onClickCapture={lp.onClickCapture}
      onContextMenu={lp.onContextMenu}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onPress?.(); }}
      onPointerDown={(e) => { if (disabled) return; setPressed(true); onPressIn?.(); lp.onPointerDown?.(e); }}
      onPointerMove={lp.onPointerMove}
      onPointerUp={() => { setPressed(false); lp.onPointerUp?.(undefined); }}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => { setPressed(false); lp.onPointerCancel?.(undefined); }}
      style={sx({ cursor: disabled ? 'default' : 'pointer', touchAction: 'manipulation' }, typeof style === 'function' ? style(st) : style)}
    >
      {typeof children === 'function' ? children(st) : children}
    </div>
  );
}

type Offset = { nativeEvent: { contentOffset: { x: number; y: number } } };
export type ScrollViewHandle = { scrollTo(o: { x?: number; y?: number; animated?: boolean }): void; scrollToEnd(o?: { animated?: boolean }): void };

type ScrollViewProps = {
  style?: Style;
  contentContainerStyle?: Style;
  horizontal?: boolean;
  pagingEnabled?: boolean;
  snapToInterval?: number;
  children?: ReactNode;
  onScroll?: (e: Offset) => void;
  onMomentumScrollEnd?: (e: Offset) => void;
  onLayout?: (e: LayoutEvent) => void;
  onContentSizeChange?: (w: number, h: number) => void;
  ref?: Ref<ScrollViewHandle | null>;
  [ignored: string]: unknown;
};

/** Scrollable div. Paging and snapToInterval use CSS scroll snap on the direct children; onMomentumScrollEnd fires once scrolling has been still for 120 ms. */
export function ScrollView({ style, contentContainerStyle, horizontal, pagingEnabled, snapToInterval, children, onScroll, onMomentumScrollEnd, onLayout, onContentSizeChange, ref }: ScrollViewProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const settle = useRef(0);
  const sizeCb = useRef(onContentSizeChange);
  sizeCb.current = onContentSizeChange;
  useLayout(outer, onLayout);
  useImperativeHandle(ref, () => ({
    scrollTo: ({ x, y, animated }) => outer.current?.scrollTo({ left: x, top: y, behavior: animated === false ? 'instant' : 'smooth' }),
    scrollToEnd: ({ animated } = {}) => {
      const el = outer.current;
      if (el) el.scrollTo({ left: horizontal ? el.scrollWidth : 0, top: horizontal ? 0 : el.scrollHeight, behavior: animated === false ? 'instant' : 'smooth' });
    },
  }));
  const wantsSize = !!onContentSizeChange;
  useEffect(() => {
    const n = inner.current;
    if (!wantsSize || !n) return;
    const ro = new ResizeObserver(() => sizeCb.current?.(n.scrollWidth, n.scrollHeight));
    ro.observe(n);
    return () => ro.disconnect();
  }, [wantsSize]);
  const snap = pagingEnabled || !!snapToInterval;
  const offset = (): Offset => ({ nativeEvent: { contentOffset: { x: outer.current!.scrollLeft, y: outer.current!.scrollTop } } });
  return (
    <div
      ref={outer}
      className="noscrollbar"
      onScroll={() => {
        onScroll?.(offset());
        if (!onMomentumScrollEnd) return;
        clearTimeout(settle.current);
        settle.current = window.setTimeout(() => onMomentumScrollEnd(offset()), 120);
      }}
      style={sx(
        { flexGrow: 1, flexShrink: 1, flexDirection: horizontal ? 'row' : 'column', overflowX: horizontal ? 'auto' : 'hidden', overflowY: horizontal ? 'hidden' : 'auto', overscrollBehavior: 'contain' },
        snap && { scrollSnapType: `${horizontal ? 'x' : 'y'} mandatory` },
        style,
      )}
    >
      <div ref={inner} className={snap ? 'snap-kids' : undefined} style={sx(horizontal && { flexDirection: 'row' }, contentContainerStyle)}>
        {children}
      </div>
    </div>
  );
}

type TextInputProps = {
  value?: string;
  defaultValue?: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  style?: Style;
  multiline?: boolean;
  keyboardType?: string;
  autoFocus?: boolean;
  selectTextOnFocus?: boolean;
  onSubmitEditing?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  [ignored: string]: unknown;
};

const MODES: Record<string, 'decimal' | 'numeric' | 'email' | undefined> = { numeric: 'decimal', 'decimal-pad': 'decimal', 'number-pad': 'numeric', 'email-address': 'email' };

export function TextInput({ value, defaultValue, onChangeText, placeholder, style, multiline, keyboardType, autoFocus, selectTextOnFocus, onSubmitEditing, onFocus, onBlur, autoCapitalize, maxLength }: TextInputProps) {
  const common = {
    value,
    defaultValue,
    placeholder,
    autoFocus,
    maxLength,
    inputMode: keyboardType ? MODES[keyboardType] : undefined,
    autoCapitalize: autoCapitalize === 'none' ? 'off' : autoCapitalize,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChangeText?.(e.target.value),
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (selectTextOnFocus) e.target.select(); onFocus?.(); },
    onBlur,
    style: sx(style),
  };
  if (multiline) return <textarea {...common} style={sx({ resize: 'none' }, style)} />;
  return <input {...common} onKeyDown={(e) => { if (e.key === 'Enter') { onSubmitEditing?.(); (e.target as HTMLInputElement).blur(); } }} />;
}

// react-native-svg: same names, plain SVG elements underneath.
export const Svg = (p: SVGProps<SVGSVGElement>) => <svg {...p} />;
export const Path = (p: SVGProps<SVGPathElement>) => <path {...p} />;
export const Circle = (p: SVGProps<SVGCircleElement>) => <circle {...p} />;
export const Rect = (p: SVGProps<SVGRectElement>) => <rect {...p} />;
export const G = (p: SVGProps<SVGGElement>) => <g {...p} />;
