import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = {
  color?: string;
  size?: number;
};

function iconDefaults({ color = '#6E6E78', size = 22 }: IconProps) {
  return { color, size };
}

export function IconEnvelope(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6.5h16a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V8A1.5 1.5 0 0 1 4 6.5Z"
        stroke={color}
        strokeWidth={1.7}
      />
      <Path
        d="m3.5 8 8.5 6 8.5-6"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 10.5V8a5 5 0 0 1 10 0v2.5"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <Path
        d="M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke={color}
        strokeWidth={1.7}
      />
    </Svg>
  );
}

export function IconEye(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.8 12S6.2 6.5 12 6.5 21.2 12 21.2 12 17.8 17.5 12 17.5 2.8 12 2.8 12Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="2.6" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

export function IconEyeOff(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3l18 18"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <Path
        d="M9.5 6.8C10.3 6.6 11.1 6.5 12 6.5c5.8 0 9.2 5.5 9.2 5.5a16 16 0 0 1-3.2 3.8M6.4 8.4A16.4 16.4 0 0 0 2.8 12S6.2 17.5 12 17.5c1.2 0 2.3-.2 3.3-.6"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconPeople(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3.1" stroke={color} strokeWidth={1.7} />
      <Path
        d="M3.5 19c.4-3.2 3-5 5.5-5s5.1 1.8 5.5 5"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <Circle cx="17" cy="8.5" r="2.4" stroke={color} strokeWidth={1.7} />
      <Path
        d="M16.2 14.2c2 .3 3.8 1.7 4.3 4.3"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconChat(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 11.5c0 4.1-3.8 7.5-8.5 7.5-1.1 0-2.1-.2-3-.5L4 20.2l1.4-3.4A7.3 7.3 0 0 1 4 11.5C4 7.4 7.8 4 12.5 4S20 7.4 20 11.5Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconAccount(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.4" stroke={color} strokeWidth={1.7} />
      <Path
        d="M5 19.2c.6-3.6 3.4-5.4 7-5.4s6.4 1.8 7 5.4"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconAt(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3.1" stroke={color} strokeWidth={1.7} />
      <Path
        d="M15.1 12v1.4a2.1 2.1 0 0 0 4.2 0V12a7.3 7.3 0 1 0-2.4 5.5"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconPhone(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.2 4.8h2.3l1 3.2-1.8 1.1a12.2 12.2 0 0 0 5.2 5.2l1.1-1.8 3.2 1v2.3c0 .7-.6 1.4-1.3 1.5-7.2.9-13.1-5-12.2-12.2.1-.7.8-1.3 1.5-1.3Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconUser(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8.2" r="3.2" stroke={color} strokeWidth={1.7} />
      <Path
        d="M5.4 18.8c.5-3.2 3.1-4.8 6.6-4.8s6.1 1.6 6.6 4.8"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconCamera(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 8.2 9.2 6.5h5.6L16 8.2h2.2A1.8 1.8 0 0 1 20 10v7.2A1.8 1.8 0 0 1 18.2 19H5.8A1.8 1.8 0 0 1 4 17.2V10a1.8 1.8 0 0 1 1.8-1.8H8Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="13.2" r="2.6" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

export function IconResenha(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s6.5-5.4 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.6 6.5 11 6.5 11Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="2.3" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5.5 8.5 12 15 18.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  const { color, size } = iconDefaults(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5.5v13" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M5.5 12h13" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
