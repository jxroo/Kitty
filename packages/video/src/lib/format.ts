// Same grouping as the app's formatZl (packages/web/src/lib/kasa.ts), but always grouped and with a
// no-break space, so a counting number never wraps or changes its grouping mid-count.
export const zl = (value: number, unit = true) => {
  const whole = Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return unit ? `${whole}\u00a0zł` : whole;
};
