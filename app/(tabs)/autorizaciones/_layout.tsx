import { Stack } from 'expo-router'

// One Stack per Drawer section (audit A-05): back from an inner screen returns to the previous screen of this
// section instead of the Drawer's first route. The anchor keeps the section index behind a screen opened by
// a deep link (cold start).
export const unstable_settings = { initialRouteName: 'index' }

export default function SectionLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
