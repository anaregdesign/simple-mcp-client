/**
 * Client UI component module.
 */
import { FluentUI } from "~/components/shared/fluent";
import { ConfigSection } from "~/components/shared/ConfigSection";
import { SubSection } from "~/components/shared/SubSection";
import { THEME_MODE_OPTIONS } from "~/lib/constants/client";
import type { ThemeMode } from "~/lib/domain/value-objects/theme-mode";
import styles from "~/components/config/settings/AppearanceSection.module.css";

const { Select } = FluentUI;

type AppearanceSectionProps = {
  theme: ThemeMode;
  onThemeChange: (nextTheme: ThemeMode) => void;
};

export function AppearanceSection(props: AppearanceSectionProps) {
  const { theme, onThemeChange } = props;

  return (
    <ConfigSection
      className={styles.root}
      title="Appearance 🎨"
      description="Choose a theme for Playground UI. Changes apply immediately."
    >
      <SubSection
        className={styles.themeSubsection}
        title="Theme"
        description="Switch Playground visual theme. Preference is saved locally."
      >
        <Select
          id="appearance-theme-select"
          aria-label="Theme"
          value={theme}
          onChange={(_, data) => {
            const nextTheme = data.value;
            if (nextTheme === "light" || nextTheme === "dark") {
              onThemeChange(nextTheme);
            }
          }}
          title="Select Playground theme."
        >
          {THEME_MODE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </SubSection>
    </ConfigSection>
  );
}
