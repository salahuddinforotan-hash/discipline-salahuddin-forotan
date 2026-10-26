import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.salahuddinforotan.discipline",
  appName: "Discipline",
  webDir: "dist",
  plugins: {
    LocalNotifications: {
      iconColor: "#818cf8",
    },
  },
};

export default config;
