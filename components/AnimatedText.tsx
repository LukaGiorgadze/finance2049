import { Text, type TextProps, type TextStyle } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';

function TextWithTextProp({ text, ...rest }: TextProps & { text: string }) {
  return <Text {...rest}>{text}</Text>;
}

const AnimatedTextComponent = Animated.createAnimatedComponent(TextWithTextProp);

export function AnimatedText({
  text,
  style,
}: {
  text: SharedValue<string>;
  style?: TextStyle;
}) {
  return <AnimatedTextComponent style={style} text={text} />;
}
