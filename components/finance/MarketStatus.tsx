import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SectionTitle } from '@/components/ui/section-title';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMarketStatus } from '@/lib/hooks/useMarketStatus';
import type { MarketHoliday } from '@/lib/services/types';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export function MarketStatus() {
  const { status, holidays, loading } = useMarketStatus();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const [visible, setVisible] = useState(false);

  // Don't render if loading or market is open
  if (loading || !status) return null;

  // Only show when market is closed or in extended hours
  const isClosed = status.market === 'closed';
  const isExtendedHours = status.market === 'extended-hours';

  if (!isClosed && !isExtendedHours) return null;

  // Build list of closed/extended exchanges
  const exchanges: string[] = [];
  if (status.exchanges.nasdaq !== 'open') exchanges.push('NASDAQ');
  if (status.exchanges.nyse !== 'open') exchanges.push('NYSE');
  if (status.exchanges.otc !== 'open') exchanges.push('OTC');

  if (exchanges.length === 0) return null;

  const exchangeText = exchanges.join(', ');
  const statusText = isClosed ? 'closed' : 'extended hours';

  const formatStatus = (s: string): string => {
    if (s === 'closed') return 'Closed';
    if (s === 'extended-hours') return 'Extended';
    if (s === 'open') return 'Open';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const getStatusColor = (s: string): string => {
    if (s === 'open') return colors.green;
    if (s === 'extended-hours') return colors.amber;
    return colors.icon;
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <>
      <ThemedView
        lightColor="transparent"
        darkColor="transparent"
        style={styles.container}
      >
        <TouchableOpacity onPress={() => setVisible(true)} activeOpacity={0.7}>
          <ThemedView
            lightColor={Colors.light.warningBannerLight}
            darkColor={Colors.dark.warningBannerDark}
            style={styles.banner}
          >
            <Ionicons
              name="time-outline"
              size={12}
              color={colors.yellowMuted}
              style={styles.icon}
            />
            <ThemedText
              lightColor={Colors.light.yellowMuted}
              darkColor={Colors.dark.yellow}
              style={styles.text}
            >
              {exchangeText} {statusText}
            </ThemedText>
            <Ionicons
              name="chevron-forward"
              size={12}
              color={colors.yellowMuted}
              style={styles.chevron}
            />
          </ThemedView>
        </TouchableOpacity>
      </ThemedView>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <SectionTitle style={styles.headerTitle}>Market Status</SectionTitle>
              <ThemedText style={[styles.headerTime, { color: colors.icon }]}>
                {formatTime(status.serverTime)}
              </ThemedText>
            </View>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Exchanges */}
            <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
              <ThemedText style={styles.sectionTitle}>Exchanges</ThemedText>
              <StatusRow label="NASDAQ" value={formatStatus(status.exchanges.nasdaq)} color={getStatusColor(status.exchanges.nasdaq)} borderColor={colors.cardBorder} isLast={false} />
              <StatusRow label="NYSE" value={formatStatus(status.exchanges.nyse)} color={getStatusColor(status.exchanges.nyse)} borderColor={colors.cardBorder} isLast={false} />
              <StatusRow label="OTC" value={formatStatus(status.exchanges.otc)} color={getStatusColor(status.exchanges.otc)} borderColor={colors.cardBorder} isLast />
            </View>

            {/* Currencies */}
            {status.currencies && (
              <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
                <ThemedText style={styles.sectionTitle}>Currencies</ThemedText>
                <StatusRow label="Crypto" value={formatStatus(status.currencies.crypto)} color={getStatusColor(status.currencies.crypto)} borderColor={colors.cardBorder} isLast={false} />
                <StatusRow label="Forex" value={formatStatus(status.currencies.fx)} color={getStatusColor(status.currencies.fx)} borderColor={colors.cardBorder} isLast />
              </View>
            )}

            {/* Upcoming Holidays */}
            {holidays.length > 0 && (
              <HolidaysSection holidays={holidays} colors={colors} />
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Status Row (exchanges & currencies)
// ---------------------------------------------------------------------------

function StatusRow({ label, value, color, borderColor, isLast }: {
  label: string;
  value: string;
  color: string;
  borderColor: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, { borderBottomColor: borderColor }, isLast && { borderBottomWidth: 0 }]}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <View style={styles.rowRight}>
        <ThemedText style={[styles.rowValue, { color }]}>{value}</ThemedText>
        <View style={[styles.rowDot, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Holidays Section
// ---------------------------------------------------------------------------

interface GroupedHoliday {
  date: string;
  name: string;
  entries: MarketHoliday[];
}

function HolidaysSection({ holidays, colors }: { holidays: MarketHoliday[]; colors: typeof Colors.light }) {
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedHoliday>();
    for (const h of holidays) {
      const key = `${h.date}-${h.name}`;
      if (!map.has(key)) {
        map.set(key, { date: h.date, name: h.name, entries: [] });
      }
      map.get(key)!.entries.push(h);
    }
    return Array.from(map.values());
  }, [holidays]);

  const formatDate = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getHolidayStatusColor = (status: string): string => {
    if (status === 'early-close') return colors.amber;
    return colors.icon;
  };

  const formatHolidayStatus = (entry: MarketHoliday): string => {
    if (entry.status === 'early-close' && entry.close) {
      const time = new Date(entry.close).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      return `Closes ${time}`;
    }
    if (entry.status === 'closed') return 'Closed';
    return entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
  };

  return (
    <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
      <ThemedText style={styles.sectionTitle}>Upcoming Holidays</ThemedText>
      {grouped.map((group, gi) => {
        const isLastGroup = gi === grouped.length - 1;
        return (
          <View
            key={`${group.date}-${group.name}`}
            style={[
              styles.holidayGroup,
              { borderBottomColor: colors.cardBorder },
              isLastGroup && { borderBottomWidth: 0 },
            ]}
          >
            <View style={styles.holidayHeader}>
              <ThemedText style={styles.holidayName}>{group.name}</ThemedText>
              <ThemedText style={[styles.holidayDate, { color: colors.icon }]}>
                {formatDate(group.date)}
              </ThemedText>
            </View>
            <View style={styles.holidayExchanges}>
              {group.entries.map((entry) => (
                <View key={entry.exchange} style={styles.holidayChip}>
                  <ThemedText style={[styles.holidayChipExchange, { color: colors.text }]}>
                    {entry.exchange}
                  </ThemedText>
                  <ThemedText style={[styles.holidayChipStatus, { color: getHolidayStatusColor(entry.status) }]}>
                    {formatHolidayStatus(entry)}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  icon: {
    marginRight: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  chevron: {
    opacity: 0.6,
  },
  modalContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
  },
  headerTime: {
    fontSize: 12,
    fontWeight: '400',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  section: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    opacity: 0.35,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Holiday styles
  holidayGroup: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  holidayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  holidayName: {
    fontSize: 15,
    fontWeight: '500',
  },
  holidayDate: {
    fontSize: 13,
    fontWeight: '400',
  },
  holidayExchanges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  holidayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  holidayChipExchange: {
    fontSize: 12,
    fontWeight: '600',
  },
  holidayChipStatus: {
    fontSize: 12,
    fontWeight: '400',
  },
});
