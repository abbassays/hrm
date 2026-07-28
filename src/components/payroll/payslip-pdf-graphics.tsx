import { Circle, G, Line, Path, Polygon, Svg } from '@react-pdf/renderer';
import React from 'react';

import {
  bitsmithsLogoPaths,
  contactIconPaths,
  payslipPdfColors as c,
  payslipPdfMetrics as m,
} from '@/constants/payslip-pdf';

import { payslipPdfStyles as styles } from './payslip-pdf-styles';

import { PayslipContactKind, PayslipLogoVariant } from '@/types/hrm';

type BitsmithsMarkProps = {
  size?: number;
  variant?: PayslipLogoVariant;
};

export function BitsmithsMark({
  size = 30,
  variant = 'default',
}: BitsmithsMarkProps) {
  const darkFill =
    variant === 'light'
      ? c.white
      : variant === 'watermark'
        ? c.watermarkDark
        : c.logoDark;

  const greenFill =
    variant === 'light'
      ? c.white
      : variant === 'watermark'
        ? c.watermarkGreen
        : c.brandGreen;

  return (
    <Svg width={size} height={(size * 21) / 20} viewBox='0 0 20 21'>
      <Path d={bitsmithsLogoPaths.bottomLeaf} fill={darkFill} />
      <Path d={bitsmithsLogoPaths.topLeaves} fill={greenFill} />
    </Svg>
  );
}

export function TopBar() {
  const h = m.barHeight + m.wedgeDrop;
  const w = m.pageWidth;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Polygon
        points={`0,0 ${w},0 ${w},${m.barHeight} 0,${m.barHeight}`}
        fill={c.ink}
      />
      <Polygon
        points={`${w - m.wedgeWidth},${m.barHeight} ${w},${m.barHeight} ${w},${h} ${w - m.wedgeWidth + m.wedgeSlope},${h}`}
        fill={c.brandGreen}
      />
    </Svg>
  );
}

export function BottomBar() {
  const h = m.barHeight + m.wedgeDrop;
  const w = m.pageWidth;
  const barTop = h - m.barHeight;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Polygon
        points={`0,${barTop} ${w},${barTop} ${w},${h} 0,${h}`}
        fill={c.ink}
      />
      <Polygon
        points={`0,0 ${m.wedgeWidth - m.wedgeSlope},0 ${m.wedgeWidth},${barTop} 0,${barTop}`}
        fill={c.brandGreen}
      />
    </Svg>
  );
}

export function ContactIcon({ kind }: { kind: PayslipContactKind }) {
  const s = m.contactIconSize;

  if (kind === 'site') {
    return (
      <Svg width={s} height={s} viewBox='0 0 24 24' style={styles.footerIcon}>
        <G stroke={c.ink} strokeWidth={1.6} fill='none'>
          <Circle cx='12' cy='12' r='9.5' />
          <Line x1='2.5' y1='12' x2='21.5' y2='12' />
          <Path d={contactIconPaths.globeMeridian} />
        </G>
      </Svg>
    );
  }

  if (kind === 'phone') {
    return (
      <Svg width={s} height={s} viewBox='0 0 24 24' style={styles.footerIcon}>
        <Circle cx='12' cy='12' r='11' fill={c.ink} />
        <Path d={contactIconPaths.phone} fill={c.white} />
      </Svg>
    );
  }

  return (
    <Svg width={s} height={s} viewBox='0 0 24 24' style={styles.footerIcon}>
      <Circle cx='12' cy='12' r='11' fill={c.ink} />
      <Path d={contactIconPaths.pin} fill={c.white} />
      <Circle cx='12' cy='10' r='1.7' fill={c.ink} />
    </Svg>
  );
}
