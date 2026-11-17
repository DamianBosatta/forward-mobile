/**
 * Shared virtualization tuning for long paginated lists (REN-02).
 * Spread into FlatList / SectionList: `<FlatList {...LISTA_LARGA_PROPS} />`.
 * Rows have variable height, so no getItemLayout.
 */
export const LISTA_LARGA_PROPS = {
  initialNumToRender: 10,
  maxToRenderPerBatch: 10,
  windowSize: 7,
  removeClippedSubviews: true,
} as const
