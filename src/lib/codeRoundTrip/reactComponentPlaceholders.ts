import { PML_PHONE_COLUMN_WIDTH } from "@/lib/craftBridge/pmlScreenMetrics";

/** PML card inner width (--card-width). */
const PML_CARD_WIDTH = 344;

/** Default canvas size for imported external components (not defined in the same file). */
export function placeholderSizeForComponent(tag: string): { width: number; height: number } {
  const key = tag.replace(/\./g, "");
  const full = PML_PHONE_COLUMN_WIDTH;
  const sizes: Record<string, { width: number; height: number }> = {
    Header: { width: full, height: 112 },
    Ticker: { width: full, height: 44 },
    PortfolioWidget: { width: full, height: 420 },
    SectionHeader: { width: full, height: 56 },
    GoalsWidget: { width: full, height: 188 },
    ReminderWidget: { width: full, height: 200 },
    NewsWidget: { width: full, height: 220 },
    BottomNav: { width: full, height: 88 },
    Card: { width: PML_CARD_WIDTH, height: 96 },
    ListItem: { width: PML_CARD_WIDTH, height: 88 },
    IPOHomePage: { width: full, height: 640 },
    Badge: { width: 160, height: 28 },
    Icon: { width: 24, height: 24 },
    TextField: { width: full, height: 72 },
    OtpTextField: { width: full, height: 140 },
    Button: { width: full, height: 52 },
    Checkbox: { width: 48, height: 48 },
    HomeIndicator: { width: full, height: 34 },
  };
  return sizes[key] ?? { width: full, height: 72 };
}
