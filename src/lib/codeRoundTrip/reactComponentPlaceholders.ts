/** Default canvas size for imported external components (not defined in the same file). */
export function placeholderSizeForComponent(tag: string): { width: number; height: number } {
  const key = tag.replace(/\./g, "");
  const heights: Record<string, number> = {
    Header: 112,
    Ticker: 44,
    PortfolioWidget: 420,
    SectionHeader: 40,
    GoalsWidget: 188,
    ReminderWidget: 200,
    NewsWidget: 220,
    BottomNav: 88,
    Card: 96,
    IPOHomePage: 640,
    Badge: 28,
    Icon: 24,
  };
  const h = heights[key] ?? 72;
  return { width: 375, height: h };
}
