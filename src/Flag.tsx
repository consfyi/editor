import { useLingui } from "@lingui/react/macro";
import { type BoxProps, Image, Box, Tooltip } from "@mantine/core";
import { useEffect } from "react";
import classes from "./Flag.module.css";

let cache: Record<string, string | undefined> = {};

export default function Flag({
  country,
  size,
  circular = false,
  ...props
}: { country?: string; size: number; circular?: boolean } & Omit<
  BoxProps,
  "w" | "h"
>) {
  const { i18n, t } = useLingui();

  useEffect(() => {
    cache = {};
  }, [t]);

  let countryName;
  if (country != undefined) {
    const cacheKey = `${i18n.locale}:${country}`;
    countryName = cache[cacheKey] ??= new Intl.DisplayNames(i18n.locale, {
      type: "region",
    }).of(country);
  }

  return (
    <Tooltip label={countryName}>
      <Box
        component="span"
        className={`${classes.flag} ${circular ? classes.circular : ""}`}
        h={size}
        w={circular ? size : (size / 3) * 4}
        {...props}
      >
        <Image
          src={`https://cdn.jsdelivr.net/npm/flagpack@latest/flags/4x3/${country != null ? country.toLowerCase() : "lgbt"}.svg`}
          alt={countryName}
        />
      </Box>
    </Tooltip>
  );
}
