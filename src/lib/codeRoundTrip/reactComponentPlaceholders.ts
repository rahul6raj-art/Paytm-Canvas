/** Default canvas size for imported external components (not defined in the same file). */
export function placeholderSizeForComponent(tag: string): { width: number; height: number } {
  const key = tag.replace(/\./g, "");
  const sizes: Record<string, { width: number; height: number }> = {
    Header: { width: 390, height: 112 },
    Ticker: { width: 390, height: 44 },
    PortfolioWidget: { width: 390, height: 420 },
    SectionHeader: { width: 390, height: 56 },
    GoalsWidget: { width: 390, height: 188 },
    ReminderWidget: { width: 390, height: 200 },
    NewsWidget: { width: 390, height: 220 },
    BottomNav: { width: 390, height: 88 },
    Card: { width: 390, height: 96 },
    IPOHomePage: { width: 390, height: 640 },
    Badge: { width: 160, height: 28 },
    Icon: { width: 24, height: 24 },
    TextField: { width: 390, height: 72 },
    OtpTextField: { width: 390, height: 140 },
    Button: { width: 390, height: 52 },
    Checkbox: { width: 48, height: 48 },
    HomeIndicator: { width: 390, height: 34 },
  };
  return sizes[key] ?? { width: 390, height: 72 };
}
