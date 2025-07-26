import { match } from "@formatjs/intl-localematcher";
import { useLingui } from "@lingui/react/macro";
import {
  Box,
  Indicator,
  type MantineColor,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";
import {
  language_script_pairs,
  layers,
  namedFlavor,
} from "@protomaps/basemaps";
import { IconMapPinFilled } from "@tabler/icons-react";
import {
  AttributionControl,
  Map as Maplibre,
  Marker,
  type MarkerProps,
  type StyleSpecification,
} from "@vis.gl/react-maplibre";
import "maplibre-theme/icons.default.css";
import "maplibre-theme/modern.css";
import {
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  useMemo,
} from "react";
import classes from "./Map.module.css";

const API_KEY = "a4d6fb59d9d6e179";

const SUPPORTED_LANGUAGES = language_script_pairs.map((v) => v.lang);

function makeStyle({
  colorScheme,
  locale,
}: {
  colorScheme: "light" | "dark";
  locale: string;
}): StyleSpecification {
  const flavorName =
    colorScheme == "light"
      ? "light"
      : colorScheme == "dark"
        ? "dark"
        : (null as never);
  return {
    version: 8,
    sources: {
      protomaps: {
        type: "vector",
        url: `https://api.protomaps.com/tiles/v4.json?key=${API_KEY}`,
        attribution:
          '<a href="https://openstreetmap.org/copyright" target="_blank">© OpenStreetMap Contributors</a>',
      },
    },
    glyphs:
      "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${flavorName}`,
    layers: layers("protomaps", namedFlavor(flavorName), {
      lang: match([locale], SUPPORTED_LANGUAGES, "en"),
    }),

    transition: { duration: 0, delay: 0 },
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMapStyle() {
  const colorScheme = useComputedColorScheme();
  const { i18n, t } = useLingui();

  return useMemo(
    () => makeStyle({ colorScheme, locale: i18n.locale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colorScheme, t],
  );
}

export function BasicMarker({
  active = false,
  variant = "default",
  color,
  ...props
}: { active?: boolean; variant?: string; color: MantineColor } & MarkerProps) {
  const theme = useMantineTheme();

  const colors = theme.variantColorResolver({
    theme,
    color,
    variant,
  });

  return (
    <Marker {...props} subpixelPositioning>
      <Box style={{ marginTop: "-100%" }}>
        <Indicator
          position="top-start"
          color="green"
          processing
          size={12}
          withBorder
          disabled={!active}
          zIndex={2}
          offset={6}
        >
          <IconMapPinFilled
            size={32}
            color={
              variant == "light"
                ? `color-mix(in srgb, var(--mantine-color-${color}-filled), var(--mantine-color-body) 90%)`
                : colors.background
            }
            style={{
              stroke: colors.color,
            }}
          />
        </Indicator>
      </Box>
    </Marker>
  );
}

export function BasicMap({
  children,
  className,
  style,
  mapStyle,
  ...props
}: { children?: ReactNode; className?: string; style?: CSSProperties } & Omit<
  ComponentProps<typeof Maplibre>,
  "attributionControl"
>) {
  const colorScheme = useComputedColorScheme();
  const defaultMapStyle = useMapStyle();

  return (
    <div
      className={`${className ?? ""} ${colorScheme} ${classes.map}`}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
    >
      <Maplibre
        {...props}
        ref={(ref) => {
          if (ref == null) {
            return;
          }
          const map = ref.getMap();
          map.dragRotate.disable();
          map.touchPitch.disable();
          map.touchZoomRotate.disableRotation();
          map.keyboard.disableRotation();
        }}
        attributionControl={false}
        mapStyle={mapStyle != undefined ? mapStyle : defaultMapStyle}
      >
        <AttributionControl compact={false} />
        {children}
      </Maplibre>
    </div>
  );
}
