import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Center,
  Code,
  createTheme,
  Flex,
  Input,
  Loader,
  MantineProvider,
  TextInput,
} from "@mantine/core";
import "@mantine/core/styles.css";
import { DatePicker } from "@mantine/dates";
import "@mantine/dates/styles.css";
import { useForm } from "@mantine/form";
import {
  Icon123,
  IconAbc,
  IconCalendar,
  IconMapPin,
} from "@tabler/icons-react";
import { getYear, parse as parseDate } from "date-fns";
import { Suspense, useMemo } from "react";
import { messages } from "./locales/en/messages.po";
import PlacePicker from "./PlacePicker";

i18n.loadAndActivate({ locale: "en", messages });

export interface Entry {
  prefix: string;
  suffix: string;
  startDate: string;
  endDate: string;
  location: string;
  country?: string;
  latLng?: [number, number];
}

function guessLanguageForRegion(regionCode: string) {
  // "und" stands for "undetermined language" — like ICU's fallback
  return new Intl.Locale(`und-${regionCode}`).maximize().baseName;
}

function slugify(s: string, locale: string) {
  return s
    .normalize("NFKC")
    .toLocaleLowerCase(locale)
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .split(/\s+/)
    .join("-");
}

function Editor() {
  const { i18n, t } = useLingui();

  const form = useForm<Entry>({
    mode: "controlled",
    initialValues: {
      prefix: "",
      suffix: "",
      startDate: "",
      endDate: "",
      location: "",
      country: undefined,
      latLng: undefined,
    },
    validateInputOnChange: true,
    validate: {
      prefix: (value) =>
        value == "" ? <Trans>Prefix must not be empty.</Trans> : null,
      suffix: (value) =>
        value == "" ? <Trans>Suffix must not be empty.</Trans> : null,
      startDate: (value) =>
        value == "" ? <Trans>Start date must be set.</Trans> : null,
      endDate: (value) =>
        value == "" ? <Trans>End date must be set.</Trans> : null,
      location: (value) =>
        value == "" ? <Trans>Location must be set.</Trans> : null,
    },
  });

  const prefixInputProps = form.getInputProps("prefix");
  const suffixInputProps = form.getInputProps("suffix");
  const startDateInputProps = form.getInputProps("startDate");
  const endDateInputProps = form.getInputProps("endDate");
  const locationInputProps = form.getInputProps("location");

  const FORMAT: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  };

  const refDate = new Date();
  const start =
    startDateInputProps.value != ""
      ? parseDate(startDateInputProps.value, "yyyy-MM-dd", refDate)
      : null;
  const end =
    endDateInputProps.value != ""
      ? parseDate(endDateInputProps.value, "yyyy-MM-dd", refDate)
      : null;

  const dateValue =
    start != null || end != null
      ? t({
          // eslint-disable-next-line no-irregular-whitespace
          message: `${start != null ? i18n.date(start, FORMAT) : ""} – ${end != null ? i18n.date(end, FORMAT) : ""}`,
          context: "date range",
        })
      : "";

  const raw = useMemo(() => {
    const values = form.getValues();

    const slug = slugify(
      values.prefix,
      values.country != undefined
        ? guessLanguageForRegion(values.country)
        : "en",
    );

    return `\
// In ${slug}.json, add:
${JSON.stringify(
  {
    id: start != null ? getYear(start).toString() : "",
    name: `${values.prefix} ${values.suffix}`,
    startDate: values.startDate,
    endDate: values.endDate,
    location: values.location,
    country: values.country,
    latLng: values.latLng,
  },
  null,
  "  ",
)}\
`;
  }, [start, form]);

  return (
    <Flex w="100%" gap="xs" p="xs">
      <form
        style={{ width: "50%" }}
        onSubmit={form.onSubmit((values) => {
          console.log(values);
        })}
      >
        <Input.Wrapper
          {...form.getInputProps("name")}
          size="sm"
          mb="xs"
          label={<Trans>Name</Trans>}
          error={
            prefixInputProps.error != null || suffixInputProps.error != null ? (
              <>
                {prefixInputProps.error} {suffixInputProps.error}
              </>
            ) : null
          }
          description={
            <Trans>
              Include the year or number of the convention, e.g. “RainFurrest
              2016” or “Eurofurence 29”.
            </Trans>
          }
        >
          <Flex w="100%">
            <Input
              {...prefixInputProps}
              style={{ flexGrow: 1 }}
              leftSection={<IconAbc size={16} />}
            />
            <Input {...suffixInputProps} leftSection={<Icon123 size={16} />} />
          </Flex>
        </Input.Wrapper>

        <Input.Wrapper
          size="sm"
          mb="xs"
          label={<Trans>Dates</Trans>}
          error={
            startDateInputProps.error != null ||
            endDateInputProps.error != null ? (
              <>
                {startDateInputProps.error} {endDateInputProps.error}
              </>
            ) : null
          }
        >
          <TextInput
            mb="sm"
            leftSection={<IconCalendar size={16} />}
            value={dateValue}
            error={
              startDateInputProps.error != null ||
              endDateInputProps.error != null
            }
            readOnly
          />
          <Center>
            <DatePicker
              type="range"
              numberOfColumns={3}
              columnsToScroll={1}
              allowSingleDateInRange
              monthLabelFormat={(date) =>
                i18n.date(new Date(date), { month: "long", year: "numeric" })
              }
              weekdayFormat={(date) =>
                i18n.date(new Date(date), { weekday: "narrow" })
              }
              defaultValue={[
                startDateInputProps.defaultValue,
                endDateInputProps.defaultValue,
              ]}
              value={[startDateInputProps.value, endDateInputProps.value]}
              onChange={(value) => {
                const [startDate, endDate] = value;
                startDateInputProps.onChange(startDate ?? "");
                endDateInputProps.onChange(endDate ?? "");
              }}
              onFocus={() => {
                startDateInputProps.onFocus();
                endDateInputProps.onFocus();
              }}
              onBlur={() => {
                startDateInputProps.onBlur();
                endDateInputProps.onBlur();
              }}
            />
          </Center>
        </Input.Wrapper>
        <PlacePicker
          size="sm"
          mb="xs"
          error={locationInputProps.error}
          clearable
          leftSection={<IconMapPin size={16} />}
          value={
            form.values.location != null
              ? {
                  country: form.values.country,
                  latLng: form.values.latLng,
                  location: form.values.location,
                }
              : null
          }
          label={<Trans>Location</Trans>}
          onChange={(place) => {
            form.setValues((prev) => ({
              ...prev,
              location: place != null ? place.location : "",
              country: place != null ? place.country : undefined,
              latLng: place != null ? place.latLng : undefined,
            }));
          }}
        />
      </form>
      <Code style={{ flexGrow: 1 }} block>
        {raw}
      </Code>
    </Flex>
  );
}

const theme = createTheme({});

export default function App() {
  return (
    <I18nProvider i18n={i18n}>
      <MantineProvider theme={theme}>
        <Suspense
          fallback={
            <Center>
              <Loader />
            </Center>
          }
        >
          <Editor />
        </Suspense>
      </MantineProvider>
    </I18nProvider>
  );
}
