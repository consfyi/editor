import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import {
  ActionIcon,
  Box,
  Center,
  Checkbox,
  Code,
  createTheme,
  Flex,
  Input,
  Loader,
  MantineProvider,
  TextInput,
  Tooltip,
} from "@mantine/core";
import "@mantine/core/styles.css";
import {
  DateInput,
  DatePicker,
  DatesProvider,
  type DayOfWeek,
} from "@mantine/dates";
import "@mantine/dates/styles.css";
import { useForm } from "@mantine/form";
import { useClipboard } from "@mantine/hooks";
import {
  Icon123,
  IconAbc,
  IconCalendar,
  IconCopy,
  IconCopyCheck,
  IconFile,
  IconKey,
  IconMapPin,
  IconWorld,
} from "@tabler/icons-react";
import addFormats from "ajv-formats";
import addKeywords from "ajv-keywords";
import Ajv, { type ErrorObject } from "ajv/dist/2020";
import {
  addDays,
  format as formatDate,
  getDate,
  getDay,
  getMonth,
  getYear,
  parse as parseDate,
  startOfMonth,
} from "date-fns";
import { Fragment, Suspense, use, useMemo } from "react";
import { messages } from "./locales/en/messages.po";
import PlacePicker from "./PlacePicker";

i18n.loadAndActivate({ locale: "en", messages });

function myStringifyWithErrors(
  value: unknown,
  errors: ErrorObject[],
  space = 2,
): string {
  const errorsByPath: Record<string, ErrorObject[]> = {};
  for (const error of errors) {
    (errorsByPath[error.instancePath] ??= []).push(error);
  }

  const indent = " ".repeat(space);
  const seen = new WeakSet();

  function stringify(parent: string, value: unknown, depth: number): string {
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      const inner = value
        .map((v, i) => {
          const path = `${parent}/${i}`;
          const errors = errorsByPath[path] ?? [];
          const json = stringify(path, v, depth + 1);
          return `${indent.repeat(depth + 1)}${json}${i < value.length - 1 ? "," : ""}${errors.length > 0 ? ` // ${errors.map((e) => e.message).join(", ")}` : ""}`;
        })
        .join("\n");
      return `[\n${inner}\n${indent.repeat(depth)}]`;
    }

    if (value && typeof value === "object") {
      if (seen.has(value)) {
        throw new TypeError("Converting circular structure to JSON");
      }
      seen.add(value);

      const keys = Object.keys(value).filter(
        (k) => value[k as keyof typeof value] !== undefined,
      );
      if (keys.length === 0) {
        return "{}";
      }
      const inner = keys
        .map((k, i) => {
          const path = `${parent}/${k}`;
          const errors = errorsByPath[path] ?? [];
          const v = value[k as keyof typeof value];
          const json = stringify(path, v, depth + 1);
          return `${indent.repeat(depth + 1)}${JSON.stringify(k)}: ${json}${i < keys.length - 1 ? "," : ""}${errors.length > 0 ? ` // ${errors.map((e) => e.message).join(", ")}` : ""}`;
        })
        .join("\n");
      return `{\n${inner}\n${indent.repeat(depth)}}`;
    }

    return JSON.stringify(value);
  }

  return stringify("", value, 0);
}

const SCHEMA = await (async () => {
  const resp = await fetch(
    "https://raw.githubusercontent.com/consfyi/data/refs/heads/main/.tools/schema.json",
  );
  if (!resp.ok) {
    throw resp;
  }
  return await resp.json();
})();

function makeValidate() {
  const ajv = new Ajv({ allErrors: true, $data: true });
  addFormats(ajv);
  addKeywords(ajv);
  return ajv.compile(SCHEMA);
}

const QUERY_PARAMS = new URLSearchParams(window.location.search);
const seriesPromise = (async () => {
  const seriesId = QUERY_PARAMS.get("seriesId");
  if (seriesId == null) {
    return null;
  }
  const resp = await fetch(`https://data.cons.fyi/series/${seriesId}.json`);
  if (!resp.ok) {
    return null;
  }
  return (await resp.json()) as {
    name: string;
    events: {
      id: string;
      name: string;
      url: string;
      startDate: string;
      endDate: string;
      location: string;
      country?: string;
      latLng?: [number, number];
      sources?: string[];
      canceled?: true;
      seriesId: string;
      timezone?: string;
    }[];
  };
})();

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

function getWeekOfMonth(date: Date) {
  return Math.ceil((getDate(date) + getDay(startOfMonth(date))) / 7);
}

function getWeekdayInNthWeek(
  year: number,
  month: number,
  weekday: DayOfWeek,
  week: number,
) {
  const firstOfMonth = new Date(year, month, 1);
  const firstDayOfWeek = getDay(firstOfMonth);
  return addDays(firstOfMonth, -firstDayOfWeek + weekday + (week - 1) * 7);
}

function addYearSameWeekday(date: Date) {
  return getWeekdayInNthWeek(
    getYear(date) + 1,
    getMonth(date),
    getDay(date) as DayOfWeek,
    getWeekOfMonth(date),
  );
}

function Editor() {
  const templateSeries = use(seriesPromise);

  let initialValues: {
    id: string | null;
    prefix: string;
    suffix: string;
    dates: [string | null, string | null];
    url: string;
    location: string;
    country?: string;
    latLng?: [number, number];
  } = {
    id: null,
    prefix: "",
    suffix: "",
    dates: [null, null],
    url: "",
    location: "",
    country: undefined,
    latLng: undefined,
  };
  if (templateSeries != null && templateSeries.events.length > 0) {
    const templateEvent =
      templateSeries.events[templateSeries.events.length - 1];

    let suffix = (getYear(new Date(templateEvent.startDate)) + 1).toString();
    const match = templateEvent.name.match(/(\d+)$/);
    if (match != null) {
      suffix = (parseInt(match[1], 10) + 1).toString();
    }

    const refDate = new Date();
    const [startDate, endDate] = [
      templateEvent.startDate,
      templateEvent.endDate,
    ].map((d) => parseDate(d, "yyyy-MM-dd", refDate));

    initialValues = {
      ...initialValues,
      prefix: templateSeries.name,
      suffix,
      url: templateEvent.url,
      dates: [addYearSameWeekday(startDate), addYearSameWeekday(endDate)].map(
        (d) => formatDate(d, "yyyy-MM-dd"),
      ) as [string, string],
      location: templateEvent.location,
      country: templateEvent.country,
      latLng: templateEvent.latLng,
    };
  }

  const { i18n } = useLingui();

  const form = useForm({
    mode: "controlled",
    initialValues,
  });

  const prefixInputProps = form.getInputProps("prefix");
  const suffixInputProps = form.getInputProps("suffix");
  const datesInputProps = form.getInputProps("dates");

  const refDate = useMemo(() => new Date(), []);
  const [startDate, endDate] = datesInputProps.value.map((d: string | null) =>
    d != null ? parseDate(d, "yyyy-MM-dd", refDate) : null,
  ) as [Date | null, Date | null];

  const seriesId = useMemo(
    () =>
      slugify(
        form.values.prefix,
        form.values.country != undefined
          ? guessLanguageForRegion(form.values.country)
          : "en",
      ),
    [form.values.country, form.values.prefix],
  );

  const generatedEventId = useMemo(() => {
    const values = form.getValues();

    const idSuffix =
      endDate != null && getYear(endDate).toString() == values.suffix
        ? values.suffix
        : startDate != null
          ? getYear(startDate).toString()
          : "";
    return idSuffix != "" ? `${seriesId}-${idSuffix}` : seriesId;
  }, [form, startDate, endDate, seriesId]);

  const outputSeries = useMemo(() => {
    const values = form.getValues();

    const [startDate, endDate] = values.dates;

    return {
      name: values.prefix,
      events: [
        {
          id: values.id ?? generatedEventId,
          name:
            values.prefix != ""
              ? `${values.prefix}${values.suffix != "" ? ` ${values.suffix}` : ""}`
              : "",
          url: values.url,
          startDate: startDate ?? "",
          endDate: endDate ?? "",
          location: values.location,
          country: values.country,
          latLng: values.latLng,
        },
        ...(templateSeries != null
          ? templateSeries.events.map(
              (
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                { timezone, seriesId: conId, ...event },
              ) => event,
            )
          : []),
      ],
    };
  }, [templateSeries, generatedEventId, form]);

  const validationErrors = useMemo(() => {
    const validate = makeValidate();
    validate(outputSeries);
    return validate.errors ?? [];
  }, [outputSeries]);

  const raw = useMemo(
    () => myStringifyWithErrors(outputSeries, validationErrors),
    [validationErrors, outputSeries],
  );

  const clipboard = useClipboard();

  return (
    <Flex w="100%" gap="xs" p="xs">
      <form
        style={{ width: "800px" }}
        onSubmit={form.onSubmit((values) => {
          console.log(values);
        })}
      >
        <TextInput
          {...form.getInputProps("id")}
          leftSection={<IconKey size={16} />}
          label={<Trans>ID</Trans>}
          value={form.values.id ?? generatedEventId}
          onChange={(e) => {
            form.setValues((prev) => ({ ...prev, id: e.target.value }));
          }}
          disabled={form.values.id == null}
          rightSectionWidth="auto"
          rightSection={
            <Checkbox
              px="xs"
              label={<Trans>Auto</Trans>}
              checked={form.values.id == null}
              onChange={(e) => {
                form.setValues((prev) => ({
                  ...prev,
                  id: e.target.checked ? null : "",
                }));
              }}
            />
          }
        />
        <Input.Wrapper
          {...form.getInputProps("name")}
          size="sm"
          mb="xs"
          label={<Trans>Name</Trans>}
        >
          <Flex w="100%" gap="xs">
            <Input
              {...prefixInputProps}
              style={{ flexGrow: 1 }}
              leftSection={<IconAbc size={16} />}
            />
            <Input {...suffixInputProps} leftSection={<Icon123 size={16} />} />
          </Flex>
        </Input.Wrapper>
        <TextInput
          {...form.getInputProps("url")}
          size="sm"
          mb="xs"
          label={<Trans>Website</Trans>}
          leftSection={<IconWorld size={16} />}
        />
        <Input.Wrapper size="sm" mb="xs" label={<Trans>Dates</Trans>}>
          <Flex mb="xs" gap="xs">
            <DateInput
              size="sm"
              leftSection={<IconCalendar size={16} />}
              popoverProps={{ disabled: true }}
              value={startDate}
              valueFormat="YYYY-MM-DD"
              onChange={(value) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [_, endDate] = datesInputProps.value;
                datesInputProps.onChange([value, endDate]);
              }}
              style={{ flexGrow: 1 }}
            />
            <DateInput
              size="sm"
              leftSection={<IconCalendar size={16} />}
              popoverProps={{ disabled: true }}
              value={endDate}
              valueFormat="YYYY-MM-DD"
              onChange={(value) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [startDate, _] = datesInputProps.value;
                datesInputProps.onChange([startDate, value]);
              }}
              style={{ flexGrow: 1 }}
            />
          </Flex>
          <Center>
            <DatePicker
              {...datesInputProps}
              defaultDate={startDate ?? undefined}
              type="range"
              numberOfColumns={2}
              columnsToScroll={1}
              allowSingleDateInRange
              monthLabelFormat={(date) =>
                i18n.date(parseDate(date, "yyyy-MM-dd", refDate), {
                  month: "long",
                  year: "numeric",
                })
              }
              weekdayFormat={(date) =>
                i18n.date(parseDate(date, "yyyy-MM-dd", refDate), {
                  weekday: "narrow",
                })
              }
            />
          </Center>
        </Input.Wrapper>
        <PlacePicker
          size="sm"
          mb="xs"
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
      <Flex style={{ flexGrow: 1, flexDirection: "column" }} gap={6}>
        <TextInput
          readOnly
          value={`${seriesId}.json`}
          size="xs"
          leftSection={<IconFile size={14} />}
        />
        <Box style={{ position: "relative", flexGrow: 1 }}>
          <Code
            h="100%"
            block
            style={{ wordWrap: "break-word", whiteSpace: "pre-wrap" }}
          >
            {raw.split("\n").map((v, i) => {
              const j = v.indexOf("//");

              return (
                <Fragment key={i}>
                  {j >= 0 ? (
                    <>
                      {v.slice(0, j)}
                      <span
                        style={{
                          color: "var(--mantine-color-error)",
                        }}
                      >
                        {v.slice(j)}
                      </span>
                    </>
                  ) : (
                    v
                  )}
                  {"\n"}
                </Fragment>
              );
            })}
          </Code>
          <Tooltip
            c={validationErrors.length > 0 ? "red" : undefined}
            position="left"
            label={
              validationErrors.length > 0 ? (
                <Plural
                  value={validationErrors.length}
                  one="There is # error to resolve."
                  other="There are # errors to resolve."
                />
              ) : clipboard.copied ? (
                <Trans>Copied!</Trans>
              ) : (
                <Trans>Copy to clipboard</Trans>
              )
            }
          >
            <ActionIcon
              disabled={validationErrors.length > 0}
              pos="absolute"
              right={6}
              top={6}
              variant="default"
              onClick={() => {
                clipboard.copy(raw);
              }}
            >
              {clipboard.copied ? (
                <IconCopyCheck size={16} />
              ) : (
                <IconCopy size={16} />
              )}
            </ActionIcon>
          </Tooltip>
        </Box>
      </Flex>
    </Flex>
  );
}

const theme = createTheme({});

const WEEK_INFO = (() => {
  const locale = new Intl.Locale(navigator.language);
  return (
    (
      locale as {
        getWeekInfo?(): { firstDay: number; weekend: number[] };
      }
    ).getWeekInfo?.() ?? { firstDay: 7, weekend: [6, 7] }
  );
})();

export default function App() {
  return (
    <I18nProvider i18n={i18n}>
      <MantineProvider theme={theme}>
        <DatesProvider
          settings={{
            firstDayOfWeek: (WEEK_INFO.firstDay % 7) as DayOfWeek,
            weekendDays: WEEK_INFO.weekend.map((d) => (d % 7) as DayOfWeek),
          }}
        >
          <Suspense
            fallback={
              <Center>
                <Loader />
              </Center>
            }
          >
            <Editor />
          </Suspense>
        </DatesProvider>
      </MantineProvider>
    </I18nProvider>
  );
}
