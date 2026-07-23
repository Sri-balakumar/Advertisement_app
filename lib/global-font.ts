/**
 * Applies Inter app-wide without editing every <Text>/<TextInput>.
 *
 * RN's Text/TextInput are forwardRef components, so their render function lives
 * on `.render`. We wrap it to inject the Inter family that matches each element's
 * fontWeight (Android doesn't map fontWeight → weighted font files on its own).
 * Import this once (side-effect) before the app tree renders.
 */
import React from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

const FAMILY: Record<string, string> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
};

function familyFor(style: unknown): string {
  const flat = (StyleSheet.flatten(style as never) || {}) as { fontWeight?: string | number };
  const w = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  return FAMILY[w] || 'Inter_400Regular';
}

function patch(Comp: any) {
  if (!Comp || Comp.__interPatched) return;
  const orig = Comp.render;
  if (typeof orig !== 'function') return;
  Comp.render = function patchedRender(props: any, ref: any) {
    const el = orig.call(this, props, ref);
    if (!el || !el.props) return el;
    const family = familyFor(el.props.style);
    return React.cloneElement(el, { style: [{ fontFamily: family }, el.props.style] });
  };
  Comp.__interPatched = true;
}

patch(Text);
patch(TextInput);
