/**
 * Client UI component module.
 */
import { FluentUI } from "~/components/home/shared/fluent";
import { ConfigSection } from "~/components/home/shared/ConfigSection";
import { SubSection } from "~/components/home/shared/SubSection";
import { HOME_THEME_OPTIONS } from "~/lib/constants";
import type { HomeTheme } from "~/lib/home/shared/view-types";

const { Select } = FluentUI;

type AppearanceSectionProps = {
  theme: HomeTheme;
  onHomeThemeChange: (nextTheme: HomeTheme) => void;
};

export function AppearanceSection(props: AppearanceSectionProps) {
  const { theme, onHomeThemeChange } = props;

  return (
    <ConfigSection
      className="setting-group-appearance"
      title="Appearance 🎨"
      description="Choose a theme for Playground UI. Changes apply immediately."
    >
      <SubSection
        className="appearance-theme-subsection"
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
              onHomeThemeChange(nextTheme);
            }
          }}
          title="Select Playground theme."
        >
          {HOME_THEME_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </SubSection>
    </ConfigSection>
  );
}
