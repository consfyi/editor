/// <reference types="@types/google.maps" />

import { Loader as GoogleMapsLoader } from "@googlemaps/js-api-loader";
import { Trans } from "@lingui/react/macro";
import {
  Anchor,
  Autocomplete,
  type AutocompleteProps,
  Box,
  Input,
  type InputWrapperProps,
  Loader,
  Text,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { Popup, type ViewStateChangeEvent } from "@vis.gl/react-maplibre";
import { Fragment, use, useCallback, useRef, useState } from "react";
import Flag from "./Flag";
import IntlList from "./IntlList";
import { BasicMap, BasicMarker } from "./Map";

export interface Place {
  location: string;
  country?: string;
  latLng?: [number, number];
}

const GOOGLE_MAPS_LOADER = new GoogleMapsLoader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
});

const placesLibraryPromise = GOOGLE_MAPS_LOADER.importLibrary("places");

function useSessionToken(): [
  google.maps.places.AutocompleteSessionToken,
  () => void,
] {
  const places = use(placesLibraryPromise);

  const [sessionToken, setSessionToken] = useState(
    new places.AutocompleteSessionToken(),
  );
  return [
    sessionToken,
    () => {
      setSessionToken(new places.AutocompleteSessionToken());
    },
  ];
}

export default function PlacePicker({
  value,
  label,
  onChange,
  disabled,
  onClear,
  onBlur,
  leftSection,
  rightSection,
  clearable,
  error,
  ...props
}: {
  value: Place | null;
  onChange(value: Place | null): void;
} & Omit<
  AutocompleteProps,
  | "description"
  | "value"
  | "onChange"
  | "data"
  | "renderOption"
  | "filter"
  | "onOptionSubmit"
>) {
  const places = use(placesLibraryPromise);

  const [inputValue, setInputValue] = useState(() =>
    value != null ? value.location : null,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [retrieving, setRetrieving] = useState<boolean>(false);
  const [attributions, setAttributions] = useState<
    google.maps.places.Attribution[]
  >([]);

  const [options, setOptions] = useState<
    Record<string, google.maps.places.AutocompleteSuggestion>
  >({});

  const [sessionToken, resetSessionToken] = useSessionToken();

  const ref = useRef<HTMLInputElement | null>(null);
  const needsPredictionRef = useRef(false);

  const [viewState, setViewState] = useState(
    value == null || value.latLng == null
      ? {
          latitude: 0,
          longitude: 0,
          zoom: 0,
        }
      : { latitude: value.latLng[0], longitude: value.latLng[1], zoom: 17 },
  );

  const updatePredictions = useDebouncedCallback((v: string) => {
    (async () => {
      try {
        const resp =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: v,
            locationBias: { lat: viewState.latitude, lng: viewState.longitude },
            language: "en", // I would like to use i18n.locale here, but toPlace will return a Place whose requestedLanguage cannot be changed.
            sessionToken,
          });
        if (resp == null || !needsPredictionRef.current) {
          setOptions({});
          return;
        }
        const options: Record<
          string,
          google.maps.places.AutocompleteSuggestion
        > = {};
        for (const suggestion of resp.suggestions) {
          options[suggestion.placePrediction!.placeId] = suggestion;
        }
        setOptions(options);
      } finally {
        setLoading(false);
      }
    })();
  }, 1000);

  const setValue = useCallback(
    (v: Place | null) => {
      setOptions({});
      onChange(v);
      setInputValue(v != null ? v.location : "");
      if (v == null) {
        setAttributions([]);
      }
    },
    [onChange],
  );

  return (
    <Input.Wrapper
      label={label}
      description={
        <Text span size="xs">
          <Trans>
            Place search provided by Google Maps.{" "}
            {attributions.length > 0 ? (
              <Trans>
                Result provided by{" "}
                <IntlList
                  items={attributions.map(({ provider, providerURI }) =>
                    providerURI != undefined ? (
                      <Anchor href={providerURI} target="_blank" key={provider}>
                        {provider}
                      </Anchor>
                    ) : (
                      <Fragment key={provider}>provider</Fragment>
                    ),
                  )}
                />
                .
              </Trans>
            ) : null}
          </Trans>
        </Text>
      }
      error={error}
      {...(props as InputWrapperProps)}
    >
      <Box style={{ position: "relative" }} mt={4}>
        <BasicMap
          {...viewState}
          onMove={(evt: ViewStateChangeEvent) => {
            setViewState(evt.viewState);
          }}
          style={{
            height: "600px",
            borderRadius: "var(--mantine-radius-default)",
          }}
        >
          {value != null && value.latLng != null ? (
            <>
              <BasicMarker
                latitude={value.latLng[0]}
                longitude={value.latLng[1]}
                color="red"
                variant="filled"
              />
              <Popup
                latitude={value.latLng[0]}
                longitude={value.latLng[1]}
                closeButton={false}
                closeOnClick={false}
                focusAfterOpen={false}
                maxWidth="none"
                anchor="bottom"
              >
                <Text size="sm" fw={500}>
                  <Flag
                    key={value.country}
                    country={value.country ?? undefined}
                    size={10}
                    me={6}
                  />
                  {value.location}
                </Text>
                <Text size="sm">
                  ({value.latLng[0].toFixed(4)}, {value.latLng[1].toFixed(4)})
                </Text>
              </Popup>
            </>
          ) : null}
        </BasicMap>
        <Box style={{ position: "absolute", top: 0, left: 0, width: "100%" }}>
          <Autocomplete
            {...props}
            type="search"
            m="xs"
            ref={ref}
            value={inputValue ?? undefined}
            data={Object.keys(options)}
            renderOption={({ option }) => {
              const suggestion = options[option.value];
              return (
                <Box>
                  <Text size="sm">
                    {suggestion.placePrediction!.mainText!.text}
                  </Text>
                  <Text size="xs">
                    {suggestion.placePrediction!.secondaryText != null
                      ? suggestion.placePrediction!.secondaryText.text
                      : null}
                  </Text>
                </Box>
              );
            }}
            error={error != null ? true : null}
            clearable={clearable}
            disabled={disabled || retrieving}
            leftSection={leftSection}
            rightSection={
              rightSection != null ? (
                <>
                  {loading || retrieving ? (
                    <Loader size="xs" color="dimmed" />
                  ) : null}
                  {rightSection}
                </>
              ) : loading || retrieving ? (
                <Loader size="xs" color="dimmed" />
              ) : null
            }
            filter={({ options }) => options}
            onChange={(v) => {
              if (document.activeElement !== ref.current) {
                return;
              }

              setInputValue(v);
              if (v == "") {
                return;
              }

              needsPredictionRef.current = true;
              setLoading(true);
              updatePredictions(v);
            }}
            onOptionSubmit={(v) => {
              const suggestion = options[v];
              setOptions({});
              ref.current!.blur();
              const location = [
                suggestion.placePrediction!.mainText!.text,
                ...(suggestion.placePrediction!.secondaryText != null
                  ? [suggestion.placePrediction!.secondaryText.text]
                  : []),
              ].join(", ");
              setInputValue(location);
              setRetrieving(true);
              resetSessionToken();
              (async () => {
                try {
                  const place = suggestion.placePrediction!.toPlace();
                  await place.fetchFields({
                    fields: ["location", "addressComponents", "attributions"],
                  });
                  const latLng = [
                    place.location!.lat(),
                    place.location!.lng(),
                  ] as [number, number];
                  const p = {
                    location,
                    latLng,
                    country: place.addressComponents!.find((c) =>
                      c.types.includes("country"),
                    )!.shortText!,
                  };
                  setValue(p);
                  setViewState({
                    latitude: latLng[0],
                    longitude: latLng[1],
                    zoom: 17,
                  });
                  setAttributions(place.attributions!);
                } catch (e) {
                  setInputValue("");
                  throw e;
                } finally {
                  setRetrieving(false);
                }
              })();
            }}
            onClear={() => {
              needsPredictionRef.current = false;
              setValue(null);
              if (onClear != null) {
                onClear();
              }
            }}
            onBlur={(e) => {
              needsPredictionRef.current = false;
              setOptions({});
              setInputValue(value != null ? value.location : "");
              if (onBlur != null) {
                onBlur(e);
              }
            }}
          />
        </Box>
      </Box>
    </Input.Wrapper>
  );
}
