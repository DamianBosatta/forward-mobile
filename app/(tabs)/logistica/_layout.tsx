import { Stack } from 'expo-router'

// One Stack per Drawer section (audit A-05). Logistica has no index screen: its entries (pedidos, picking, consola) are
// peers in the menu, so there is no anchor and each opens on its own; hojas is pushed on top of pedidos.
export default function SectionLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
