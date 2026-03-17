import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { formatCurrency } from '@/lib';
import type { TimelineType } from '@/lib/store/types';
import {
  Circle,
  DashPathEffect,
  LinearGradient,
  matchFont,
  Line as SkiaLine,
  vec,
} from '@shopify/react-native-skia';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { runOnJS, useAnimatedReaction, useDerivedValue } from 'react-native-reanimated';
import {
  Area,
  CartesianChart,
  Line as ChartLine,
  useChartPressState,
} from 'victory-native';

const CHART_HEIGHT = 200;
const TIMELINES: TimelineType[] = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y'];
const INIT_STATE = { x: 0, y: { y: 0 } };

export interface StockChartProps {
  chartData: { x: number; y: number; label: string; tooltipLabel: string }[];
  selectedTimeline: TimelineType;
  onTimelineChange: (timeline: TimelineType) => void;
  isPositive: boolean;
  isDark: boolean;
  isLoading?: boolean;
}

export const StockChart = React.memo(function StockChart({
  chartData,
  selectedTimeline,
  onTimelineChange,
  isPositive,
  isDark,
  isLoading = false,
}: StockChartProps) {
  const colors = isDark ? Colors.dark : Colors.light;
  const lineColor = isPositive ? colors.green : colors.red;
  const textColor = colors.text;
  const gridLineColor = colors.cardBorder;

  const { state: firstPress, isActive: isFirstPressActive } = useChartPressState(INIT_STATE);
  const { state: secondPress, isActive: isSecondPressActive } = useChartPressState(INIT_STATE);

  const font = Platform.OS !== 'web' ? matchFont({
    fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
    fontSize: 12,
    fontWeight: '400',
  }) : undefined;

  const [chartTop, setChartTop] = useState(0);
  const [chartBottom, setChartBottom] = useState(0);


  const crosshairP1 = useDerivedValue(() => vec(firstPress.x.position.value, chartTop));
  const crosshairP2 = useDerivedValue(() => vec(firstPress.x.position.value, chartBottom));
  const crosshairP1Second = useDerivedValue(() => vec(secondPress.x.position.value, chartTop));
  const crosshairP2Second = useDerivedValue(() => vec(secondPress.x.position.value, chartBottom));

  const [tooltipData, setTooltipData] = useState<{ price: number; label: string; screenX: number } | null>(null);
  const [secondTooltipData, setSecondTooltipData] = useState<{ price: number; label: string; screenX: number } | null>(null);

  const chartDataRef = useRef(chartData);
  chartDataRef.current = chartData;

  const onTooltipUpdate = useCallback((idx: number, price: number, screenX: number) => {
    const data = chartDataRef.current;
    if (idx >= 0 && idx < data.length) {
      setTooltipData({ price, label: data[idx]?.tooltipLabel ?? data[idx]?.label ?? '', screenX });
    }
  }, []);

  const onSecondTooltipUpdate = useCallback((idx: number, price: number, screenX: number) => {
    const data = chartDataRef.current;
    if (idx >= 0 && idx < data.length) {
      setSecondTooltipData({ price, label: data[idx]?.tooltipLabel ?? data[idx]?.label ?? '', screenX });
    }
  }, []);

  useAnimatedReaction(
    () => firstPress.x.value.value,
    (currentX, previousX) => {
      'worklet';
      if (currentX !== previousX) {
        const idx = Math.round(currentX);
        const price = firstPress.y.y.value.value;
        const screenX = firstPress.x.position.value;
        runOnJS(onTooltipUpdate)(idx, price, screenX);
      }
    },
  );

  useAnimatedReaction(
    () => secondPress.x.value.value,
    (currentX, previousX) => {
      'worklet';
      if (currentX !== previousX) {
        const idx = Math.round(currentX);
        const price = secondPress.y.y.value.value;
        const screenX = secondPress.x.position.value;
        runOnJS(onSecondTooltipUpdate)(idx, price, screenX);
      }
    },
  );

  useEffect(() => {
    if (!isFirstPressActive) setTooltipData(null);
  }, [isFirstPressActive]);

  useEffect(() => {
    if (!isSecondPressActive) setSecondTooltipData(null);
  }, [isSecondPressActive]);

  const TimelineSelector = ({ borderTopWidth = 1 }: { borderTopWidth?: number }) => (
    <View style={[styles.timelineWrapper, { borderTopColor: colors.divider, borderTopWidth }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timelineContainer}
      >
        {TIMELINES.map((timeline) => (
          <TouchableOpacity
            key={timeline}
            onPress={() => onTimelineChange(timeline)}
            style={[
              styles.timelineButton,
              {
                backgroundColor: selectedTimeline === timeline
                  ? colors.surfaceElevated
                  : 'transparent',
              }
            ]}
          >
            <ThemedText style={[
              styles.timelineText,
              {
                opacity: selectedTimeline === timeline ? 1 : 0.5,
                fontWeight: selectedTimeline === timeline ? '700' : '600',
              }
            ]}>
              {timeline}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
        <ThemedText style={{ opacity: 0.6, textAlign: 'center' }}>
          Interactive charts are available on mobile devices.{'\n'}
          Please use the iOS or Android app to view detailed stock performance.
        </ThemedText>
      </View>
    );
  }

  if (!isLoading && chartData.length === 0) {
    return (
      <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
        <TimelineSelector borderTopWidth={0} />
        <ThemedText style={{ opacity: 0.4, textAlign: 'center', paddingVertical: 12, fontSize: 13 }}>
          No chart data available
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.chartCard, { backgroundColor: colors.cardBackground }]}>
      <View style={styles.chartWrapper}>
        <CartesianChart
          key={selectedTimeline}
          data={chartData}
          xKey="x"
          yKeys={["y"] as const}
          chartPressState={[firstPress, secondPress]}
          padding={{ left: 5, right: 0, top: 0, bottom: 8 }}
          domainPadding={{ left: 0, right: 0, top: 0, bottom: 0 }}
          onChartBoundsChange={({ top, bottom }) => {
            setChartTop(top);
            setChartBottom(bottom);
          }}
          xAxis={{
            font,
            tickValues: (() => {
              const count = 5;
              const last = chartData.length - 1;
              if (last <= 0) return [0];
              const step = last / (count - 1);
              const raw = Array.from({ length: count }, (_, i) => Math.round(i * step));
              return [...new Set(raw)];
            })(),
            labelOffset: 5,
            labelPosition: 'outset',
            axisSide: 'bottom',
            lineWidth: 0,
            labelColor: textColor,
            formatXLabel: (value) => {
              'worklet';
              const index = Math.round(value);
              return chartData[index]?.label || '';
            },
          }}
          yAxis={[{
            font,
            tickCount: 5,
            labelOffset: 5,
            labelPosition: 'outset',
            axisSide: 'left',
            lineWidth: 1,
            lineColor: gridLineColor,
            labelColor: textColor,
            formatYLabel: (value) => {
              'worklet';
              const abs = Math.abs(value);
              if (abs >= 1000) return `$${Math.round(abs / 1000)}k`;
              if (abs < 1 && abs > 0) return `$${abs.toFixed(2)}`;
              return `$${Math.round(value)}`;
            },
          }]}
          frame={{ lineWidth: 0 }}
        >
          {({ points, chartBounds }) => (
            <>
              <Area
                points={points.y}
                y0={chartBounds.bottom}
                curveType="natural"
              >
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(0, chartBounds.bottom)}
                  colors={[lineColor, `${lineColor}33`]}
                />
              </Area>
              <ChartLine
                points={points.y}
                color={lineColor}
                strokeWidth={2.5}
                curveType="natural"
              />
              {isFirstPressActive && (
                <>
                  <SkiaLine
                    p1={crosshairP1}
                    p2={crosshairP2}
                    color={colors.crosshairMuted}
                    strokeWidth={StyleSheet.hairlineWidth}
                  >
                    <DashPathEffect intervals={[6, 4]} />
                  </SkiaLine>
                  <Circle
                    cx={firstPress.x.position}
                    cy={firstPress.y.y.position}
                    r={6}
                    color={lineColor}
                    opacity={0.8}
                  />
                </>
              )}
              {isSecondPressActive && (
                <>
                  <SkiaLine
                    p1={crosshairP1Second}
                    p2={crosshairP2Second}
                    color={colors.crosshairMuted}
                    strokeWidth={StyleSheet.hairlineWidth}
                  >
                    <DashPathEffect intervals={[6, 4]} />
                  </SkiaLine>
                  <Circle
                    cx={secondPress.x.position}
                    cy={secondPress.y.y.position}
                    r={6}
                    color={lineColor}
                    opacity={0.8}
                  />
                </>
              )}
            </>
          )}
        </CartesianChart>

        {/* Timeline transition overlay */}
        {isLoading && (
          <View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay]}>
            <ActivityIndicator size="small" color={colors.text} />
          </View>
        )}

        {/* Tooltip overlays */}
        {!isLoading && isFirstPressActive && tooltipData && (
          <View
            pointerEvents="none"
            style={[
              styles.chartTooltip,
              {
                left: tooltipData.screenX,
                backgroundColor: colors.tooltipBg,
                borderColor: colors.tooltipBorder,
              },
            ]}
          >
            <ThemedText style={styles.chartTooltipPrice}>
              {formatCurrency(tooltipData.price, 'never')}
            </ThemedText>
            <ThemedText style={styles.chartTooltipLabel}>
              {tooltipData.label}
            </ThemedText>
          </View>
        )}
        {!isLoading && isSecondPressActive && secondTooltipData && (
          <View
            pointerEvents="none"
            style={[
              styles.chartTooltip,
              {
                left: secondTooltipData.screenX,
                backgroundColor: colors.tooltipBg,
                borderColor: colors.tooltipBorder,
              },
            ]}
          >
            <ThemedText style={styles.chartTooltipPrice}>
              {formatCurrency(secondTooltipData.price, 'never')}
            </ThemedText>
            <ThemedText style={styles.chartTooltipLabel}>
              {secondTooltipData.label}
            </ThemedText>
          </View>
        )}
      </View>

      <TimelineSelector />
    </View>
  );
});

const styles = StyleSheet.create({
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartWrapper: {
    height: CHART_HEIGHT + 60,
  },
  loadingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTooltip: {
    position: 'absolute',
    top: 4,
    transform: [{ translateX: -44 }],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  chartTooltipPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  chartTooltipLabel: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 1,
  },
  timelineWrapper: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  timelineContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  timelineButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
